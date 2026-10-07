import { readFileSync } from 'node:fs';
import type { ContextEvent, CountryRelease, Decision, SeriesPoint, Source } from '../../../schema/release.ts';
import { SourceParseError } from '../../lib/errors.ts';
import { zonedInstant } from '../../lib/time.ts';
import { COUNTRIES, loadCalendar, loadSources, loadTransmission } from '../registry.ts';
import { IN_ERAS, IN_LAF_2004 } from './eras.ts';
import { parseVote } from './resolution.ts';
import type { LedgerEntry } from './backfill.ts';

type V2Source = { id: string; type: string; title: string; url: string; publishedAt?: string | null; retrievedAt?: string | null; checksum?: string | null };
type V2Decision = { id: string; date: string; repoRate: number; stance: string | null; summary: string | null; sourceIds: string[] };
type V2Event = { id: string; date: string; label: string; description: string; citation: string };
type V2Snapshot = { meta: { snapshotId: string; retrievedAt: string; latestRecordedDate?: string; latestOfficialDate?: string }; decisions: V2Decision[]; sources: V2Source[]; events: V2Event[] };

const V2_TYPES: Record<string, string> = {
  'policy-resolution': 'statement', 'policy-minutes': 'minutes', 'policy-archive': 'archive', 'current-policy-rates': 'current-rates',
  'dbie-key-rates': 'series', 'historical-rate-series': 'secondary-series', 'secondary-historical-reference': 'secondary-reference',
};
const LEDGER_FROM = '2016-10-04';
const profile = COUNTRIES.IN;
const bps = (rate: number) => Math.round(rate * 100);
const isOfficial = (url: string) => { const host = new URL(url).hostname; return profile.allowlist.some(d => host === d || host.endsWith(`.${d}`)); };
const ledger = (): LedgerEntry[] => JSON.parse(readFileSync(new URL('./mpc-decisions.json', import.meta.url), 'utf8')).entries;

/** Deterministic v2 -> v3 projection for India. v2 stays the source of truth for the series; the MPC ledger supplies statement-backed decisions. */
export function projectIndia(input: unknown, ctx: { v2ReleaseId: string; v2Sha256: string; now: string }): CountryRelease {
  const v2 = input as V2Snapshot;
  const sources = new Map<string, Source>();
  const addSource = (s: Source) => { if (!sources.has(s.id)) sources.set(s.id, s); };

  for (const s of v2.sources) {
    const type = V2_TYPES[s.type];
    if (!type) throw new SourceParseError(`Unknown v2 source type "${s.type}" on ${s.id}`);
    // v2 retrieval times and page checksums change on every fetch; keeping them would mint a new v3 release each day.
    addSource({ id: s.id, type, title: s.title, url: s.url, official: isOfficial(s.url), publishedAt: s.publishedAt ?? null, retrievedAt: null, sha256: null });
  }
  [...loadSources('IN'), IN_LAF_2004].forEach(addSource);
  const mpc = ledger();
  for (const e of mpc) addSource({ id: `in-mpc-${e.prid}`, type: 'statement', title: e.title, url: e.url, official: true, publishedAt: e.date, retrievedAt: null, sha256: null });

  // Statement-backed decisions: the curated MPC ledger, then v2's own resolution-backed records (which win on the same date).
  const statements = new Map<string, { date: string; bps: number; stance: string | null; vote: Decision['vote']; excerpt: string | null; url: string; sourceId: string; offCycle: boolean; parsedDirection?: string }>();
  for (const e of mpc) statements.set(e.date, { date: e.date, bps: e.rateBps, stance: null, vote: e.vote, excerpt: e.excerpt, url: e.url, sourceId: `in-mpc-${e.prid}`, offCycle: e.offCycle, parsedDirection: e.direction });
  for (const d of v2.decisions) {
    const resolution = d.sourceIds.map(id => v2.sources.find(s => s.id === id)).find(s => s?.type === 'policy-resolution');
    if (!resolution) continue;
    const prior = statements.get(d.date);
    statements.set(d.date, { date: d.date, bps: bps(d.repoRate), stance: d.stance, vote: prior?.vote ?? parseVote(d.summary ?? ''), excerpt: prior?.excerpt ?? null, url: resolution.url, sourceId: resolution.id, offCycle: prior?.offCycle ?? false });
  }

  // Series: v2 change points; a point is official when an official source (or a statement) backs that date.
  const ordered = [...v2.decisions].sort((a, b) => a.date.localeCompare(b.date));
  const series: SeriesPoint[] = [];
  for (const d of ordered) {
    const level = bps(d.repoRate);
    const last = series.at(-1);
    if (last && last.level.kind === 'point' && last.level.bps === level) continue;
    const statement = statements.get(d.date);
    const officialSource = d.sourceIds.find(id => sources.get(id)?.official);
    const sourceId = statement?.sourceId ?? officialSource ?? d.sourceIds[0];
    series.push({ date: d.date, level: { kind: 'point', bps: level }, evidence: statement || officialSource ? 'official' : 'secondary', sourceId });
  }

  const calendar = loadCalendar('IN');
  const meetingIds = new Set(calendar.map(m => m.id));
  const before = (date: string) => [...series].reverse().find(p => p.date < date);
  const decisions: Decision[] = [...statements.values()].sort((a, b) => a.date.localeCompare(b.date)).map(s => {
    const prev = before(s.date);
    const prevBps = prev && prev.level.kind === 'point' ? prev.level.bps : s.bps;
    const changeBps = s.bps - prevBps;
    const direction = changeBps > 0 ? 'hike' : changeBps < 0 ? 'cut' : 'hold';
    if (s.parsedDirection && s.parsedDirection !== direction) throw new SourceParseError(`Resolution ${s.date} reads as ${s.parsedDirection} but the series moved ${changeBps} bps`);
    const id = `IN-${s.date}`;
    return {
      id, meetingId: !s.offCycle && meetingIds.has(id) ? id : null,
      announcedAt: zonedInstant(s.date, profile.announceTime, profile.timeZone), effectiveDate: s.date,
      level: { kind: 'point', bps: s.bps }, direction, changeBps, eraChange: false, offCycle: s.offCycle,
      evidence: 'statement', vote: s.vote, stance: s.stance, statementUrl: s.url, excerpt: s.excerpt, sourceIds: [s.sourceId],
    };
  });

  const context: ContextEvent[] = v2.events.map(e => {
    const id = `in-event-${e.id}`;
    addSource({ id, type: 'context', title: e.label, url: e.citation, official: isOfficial(e.citation), publishedAt: e.date, retrievedAt: null, sha256: null });
    return { date: e.date, label: e.label, description: e.description, sourceId: id };
  });

  const decided = new Set(decisions.map(d => d.meetingId));
  return {
    schemaVersion: 3,
    country: { code: profile.code, name: profile.name, currency: profile.currency, locale: profile.locale, timeZone: profile.timeZone },
    authority: profile.authority,
    instrument: profile.instrument,
    eras: IN_ERAS,
    calendar: calendar.map(m => ({ ...m, status: decided.has(m.id) ? 'held' : m.status })),
    decisions,
    series,
    transmission: loadTransmission('IN'),
    context,
    sources: [...sources.values()].sort((a, b) => a.id.localeCompare(b.id)),
    coverage: {
      seriesFrom: series[0].date, ledgerFrom: LEDGER_FROM,
      grain: 'Every MPC decision from 4 Oct 2016 from its official resolution; earlier rate changes from the v2 record, with secondary sources labelled. Historical announcement times use 10:00 IST as a convention.',
    },
    corrections: [],
    release: {
      hash: '', generator: 'pipeline/countries/in',
      observedThrough: v2.meta.latestRecordedDate ?? v2.meta.latestOfficialDate ?? series.at(-1)!.date,
      upstream: { kind: 'rbi-snapshot-v2', id: ctx.v2ReleaseId, sha256: ctx.v2Sha256 },
    },
  };
}
