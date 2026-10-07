import type { Era, SeriesPoint, Source } from '../../schema/release.ts';
import { COUNTRIES, loadSources, loadTransmission } from './registry.ts';
import type { CountryCode } from './registry.ts';
import { fetchText } from '../lib/http.ts';
import { SourceParseError } from '../lib/errors.ts';
import type { CountryResult, RunContext } from '../types.ts';
import { ecb } from './ea/adapter.ts';
import { boe } from './gb/adapter.ts';
import { boc } from './ca/adapter.ts';
import { rba } from './au/adapter.ts';
import { bcb } from './br/adapter.ts';

export type Observation = { date: string; bps: number };

/** A country whose release is its official level series alone: no decision records and no calendar yet. */
export type SeriesSpec = {
  code: CountryCode;
  /** The request URLs for one run (several when the source caps the window). `today` is YYYY-MM-DD. */
  urls(today: string): string[];
  parse(body: string): Observation[];
  source: { id: string; title: string; url: string };
  era: { id: string; instrument: string; note: string };
  grain: string;
};

const HISTORY_FROM = '2000-01-01';

/** Level changes only, starting at the last change on or before `from`, so the series opens with the level in force then. */
export function changePoints(observations: Observation[], from = HISTORY_FROM): Observation[] {
  const changes = observations.filter((o, i) => i === 0 || o.bps !== observations[i - 1].bps);
  const start = Math.max(0, changes.findLastIndex(o => o.date <= from));
  return changes.slice(start);
}

/** Merges observations from several windows (later windows win on overlapping dates) into date order. */
function merge(batches: Observation[][]): Observation[] {
  const byDate = new Map<string, number>();
  for (const batch of batches) for (const o of batch) byDate.set(o.date, o.bps);
  return [...byDate].map(([date, bps]) => ({ date, bps })).sort((a, b) => a.date.localeCompare(b.date));
}

export function seriesAdapter(spec: SeriesSpec) {
  return async function run(ctx: RunContext): Promise<CountryResult> {
    const profile = COUNTRIES[spec.code];
    const today = ctx.now.slice(0, 10);
    const batches: Observation[][] = [];
    for (const url of spec.urls(today)) batches.push(spec.parse((await fetchText(url, { fetchImpl: ctx.fetchImpl })).body));
    const observations = merge(batches).filter(o => o.date <= today);
    if (!observations.length) throw new SourceParseError(`${spec.code}: the official series returned no observations`);
    const series: SeriesPoint[] = changePoints(observations).map(o => ({ date: o.date, level: { kind: 'point', bps: o.bps }, evidence: 'official', sourceId: spec.source.id }));
    const era: Era = { ...spec.era, from: series[0].date, to: null, kind: 'point', basis: 'policy', sourceId: spec.source.id };
    const seriesSource: Source = { ...spec.source, type: 'series', official: true, publishedAt: null, retrievedAt: null, sha256: null };
    return {
      statuses: [],
      release: {
        schemaVersion: 3,
        country: { code: profile.code, name: profile.name, currency: profile.currency, locale: profile.locale, timeZone: profile.timeZone },
        authority: profile.authority,
        instrument: profile.instrument,
        eras: [era],
        calendar: [],
        decisions: [],
        series,
        transmission: loadTransmission(spec.code),
        context: [],
        sources: [seriesSource, ...loadSources(spec.code)],
        coverage: { seriesFrom: series[0].date, ledgerFrom: null, grain: spec.grain },
        corrections: [],
        release: { hash: '', generator: `pipeline/countries/${spec.code.toLowerCase()}`, observedThrough: observations.at(-1)!.date },
      },
    };
  };
}

export const SERIES_ADAPTERS = {
  EA: seriesAdapter(ecb), GB: seriesAdapter(boe), CA: seriesAdapter(boc), AU: seriesAdapter(rba), BR: seriesAdapter(bcb),
} satisfies Record<string, (ctx: RunContext) => Promise<CountryResult>>;

/** Minimal CSV line split that honours double-quoted fields. */
export function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** A percent string to integer basis points; throws on anything that is not a finite number. */
export function pctToBps(value: string, where: string): number {
  const n = Number(value.trim());
  if (!value.trim() || !Number.isFinite(n)) throw new SourceParseError(`${where}: "${value}" is not a number`);
  return Math.round(n * 100);
}

const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
/** "04 Jan 2000" or "04-Jan-2000" to 2000-01-04; null when the text is not such a date. */
export function dayMonthYear(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[ -]([A-Z][a-z]{2})[ -](\d{4})$/);
  return m && MONTHS[m[2]] ? `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, '0')}` : null;
}
