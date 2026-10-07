import type { SeriesPoint } from '../../../schema/release.ts';
import { SourceParseError } from '../../lib/errors.ts';

export type Observation = { date: string; bps: number };

/** FRED graph CSV (observation_date,<ID>) to basis-point observations; FRED's "." and blanks mean no observation. */
export function parseFredCsv(csv: string, seriesId: string): Observation[] {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  if (!header || !header.split(',').includes(seriesId)) throw new SourceParseError(`FRED CSV header does not name ${seriesId}`);
  return rows.flatMap(row => {
    const [date, value] = row.split(',');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !value || value === '.') return [];
    const pct = Number(value);
    if (!Number.isFinite(pct)) throw new SourceParseError(`FRED ${seriesId} has a non-numeric value on ${date}`);
    return [{ date, bps: Math.round(pct * 100) }];
  });
}

const RANGE_FROM = '2008-12-16';
const HISTORY_FROM = '2000-01-01';

/** Change points of the federal funds target: a point target to 2008-12-15, a range from 2008-12-16 (no midpoint). */
export function buildUsSeries(point: Observation[], upper: Observation[], lower: Observation[]): SeriesPoint[] {
  const lowerByDate = new Map(lower.map(o => [o.date, o.bps]));
  const all: SeriesPoint[] = [
    ...point.filter(o => o.date < RANGE_FROM).map(o => ({ date: o.date, level: { kind: 'point' as const, bps: o.bps }, evidence: 'official' as const, sourceId: 'us-fred-dfedtar' })),
    ...upper.filter(o => o.date >= RANGE_FROM && lowerByDate.has(o.date)).map(o => ({
      date: o.date, level: { kind: 'range' as const, lowBps: lowerByDate.get(o.date) as number, highBps: o.bps }, evidence: 'official' as const, sourceId: 'us-fred-dfedtaru',
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const key = (p: SeriesPoint) => JSON.stringify(p.level);
  const changes = all.filter((p, i) => i === 0 || key(p) !== key(all[i - 1]));
  const start = Math.max(0, changes.findLastIndex(p => p.date <= HISTORY_FROM));
  return changes.slice(start);
}
