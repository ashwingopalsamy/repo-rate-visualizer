import type { Decision, Era, Source } from '../../../schema/release.ts';
import { COUNTRIES, loadCalendar, loadSources, loadTransmission } from '../registry.ts';
import { fetchText, HttpStatusError } from '../../lib/http.ts';
import { addDays, minutesBetween } from '../../lib/time.ts';
import { upperBps } from '../../../schema/level.ts';
import type { CountryResult, MeetingStatus, RunContext } from '../../types.ts';
import { buildUsSeries, parseFredCsv } from './series.ts';
import { parseFomcStatement, statementId, statementUrl } from './statement.ts';

const LEDGER_FROM = '2021-01-27';
const fredCsv = (id: string) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
const fredSource = (id: string, title: string): Source => ({ id: `us-fred-${id.toLowerCase()}`, type: 'series', title: `FRED: ${title} (${id})`, url: `https://fred.stlouisfed.org/series/${id}`, official: true, publishedAt: null, retrievedAt: null, sha256: null });

const ERAS: Era[] = [
  { id: 'us-point', from: '1982-09-27', to: '2008-12-15', instrument: 'Federal funds target rate', kind: 'point', basis: 'policy', note: 'A single target rate until 15 Dec 2008.', sourceId: 'us-fred-dfedtar' },
  { id: 'us-range', from: '2008-12-16', to: null, instrument: 'Federal funds target range', kind: 'range', basis: 'policy', note: 'A target range with both bounds since 16 Dec 2008.', sourceId: 'us-fred-dfedtaru' },
];

/** Builds the US release: the official FRED target series plus one statement-backed decision per FOMC meeting since 2021. */
export async function runUs(ctx: RunContext): Promise<CountryResult> {
  const profile = COUNTRIES.US;
  const { fetchImpl } = ctx;
  const [point, upper, lower] = await Promise.all(['DFEDTAR', 'DFEDTARU', 'DFEDTARL']
    .map(async id => parseFredCsv((await fetchText(fredCsv(id), { fetchImpl })).body, id)));
  const series = buildUsSeries(point, upper, lower);
  const seriesThrough = upper.at(-1)?.date ?? series.at(-1)?.date ?? ctx.now.slice(0, 10);

  const previous = new Map((ctx.previous?.decisions ?? []).map(d => [d.id, d]));
  const previousSources = new Map((ctx.previous?.sources ?? []).map(s => [s.id, s]));
  const decisions: Decision[] = [];
  const statementSources: Source[] = [];
  const statuses: MeetingStatus[] = [];
  const calendar = loadCalendar('US');

  for (const meeting of calendar) {
    if (meeting.date < LEDGER_FROM || minutesBetween(meeting.announceAt, ctx.now) < 0) continue;
    const prior = previous.get(meeting.id);
    if (prior) {
      decisions.push(prior);
      prior.sourceIds.forEach(id => { const s = previousSources.get(id); if (s) statementSources.push(s); });
      statuses.push({ meetingId: meeting.id, state: 'verified' });
      continue;
    }
    try {
      const page = await fetchText(statementUrl(meeting), { fetchImpl, retries: 1 });
      const before = [...series].reverse().find(p => p.date < addDays(meeting.date, meeting.effectiveLagDays));
      decisions.push(parseFomcStatement(page.body, meeting, before ? upperBps(before.level) ?? undefined : undefined));
      statementSources.push({ id: `us-statement-${statementId(meeting)}`, type: 'statement', title: `FOMC statement, ${meeting.date}`, url: statementUrl(meeting), official: true, publishedAt: meeting.date, retrievedAt: page.fetchedAt, sha256: null });
      statuses.push({ meetingId: meeting.id, state: 'verified' });
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 404) statuses.push({ meetingId: meeting.id, state: 'pending', detail: 'Statement not published yet' });
      else throw error;
    }
  }

  const verified = new Set(decisions.map(d => d.meetingId));
  return {
    statuses,
    release: {
      schemaVersion: 3,
      country: { code: profile.code, name: profile.name, currency: profile.currency, locale: profile.locale, timeZone: profile.timeZone },
      authority: profile.authority,
      instrument: profile.instrument,
      eras: ERAS,
      calendar: calendar.map(m => ({ ...m, status: verified.has(m.id) ? 'held' : m.status })),
      decisions: decisions.sort((a, b) => a.announcedAt.localeCompare(b.announcedAt)),
      series,
      transmission: loadTransmission('US'),
      context: [],
      sources: [
        fredSource('DFEDTAR', 'Federal Funds Target Rate (discontinued)'),
        fredSource('DFEDTARU', 'Federal Funds Target Range, Upper Limit'),
        fredSource('DFEDTARL', 'Federal Funds Target Range, Lower Limit'),
        ...loadSources('US'),
        ...statementSources,
      ],
      coverage: {
        seriesFrom: series[0].date, ledgerFrom: LEDGER_FROM,
        grain: 'Every scheduled FOMC meeting from 27 Jan 2021, from its statement; target changes before then from the official FRED series (effective dates).',
      },
      corrections: [],
      release: { hash: '', generator: 'pipeline/countries/us', observedThrough: seriesThrough },
    },
  };
}
