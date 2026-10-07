import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildUsSeries, parseFredCsv } from '../../pipeline/countries/us/series.ts';
import { parseFomcStatement, parseFraction } from '../../pipeline/countries/us/statement.ts';
import { runUs } from '../../pipeline/countries/us/adapter.ts';
import { loadCalendar, COUNTRIES } from '../../pipeline/countries/registry.ts';
import { validateRelease } from '../../schema/invariants.ts';
import { SourceParseError } from '../../pipeline/lib/errors.ts';

const fixture = (name: string) => readFileSync(new URL(`../fixtures/us/${name}`, import.meta.url), 'utf8');
const meeting = (id: string) => {
  const m = loadCalendar('US').find(x => x.id === id);
  assert.ok(m, id);
  return m;
};

test('parseFredCsv skips missing values and converts percent to basis points', () => {
  const rows = parseFredCsv('observation_date,DFEDTARU\n2026-09-16,3.75\n2026-09-17,4.00\n2026-09-18,.\n2026-09-19,\n', 'DFEDTARU');
  assert.deepEqual(rows, [{ date: '2026-09-16', bps: 375 }, { date: '2026-09-17', bps: 400 }]);
});

test('buildUsSeries switches from a point to a range on 2008-12-16 and never stores a midpoint', () => {
  const series = buildUsSeries(parseFredCsv(fixture('DFEDTAR.csv'), 'DFEDTAR'), parseFredCsv(fixture('DFEDTARU.csv'), 'DFEDTARU'), parseFredCsv(fixture('DFEDTARL.csv'), 'DFEDTARL'));
  const switchover = series.find(p => p.date === '2008-12-16');
  assert.deepEqual(switchover?.level, { kind: 'range', lowBps: 0, highBps: 25 });
  assert.deepEqual(series.find(p => p.date === '2008-12-15')?.level ?? series.filter(p => p.date < '2008-12-16').at(-1)?.level, { kind: 'point', bps: 100 });
  const last = series.at(-1);
  assert.equal(last?.date, '2026-09-17');
  assert.deepEqual(last?.level, { kind: 'range', lowBps: 375, highBps: 400 });
  for (let i = 1; i < series.length; i++) assert.ok(series[i].date > series[i - 1].date);
  assert.ok(series.every(p => p.evidence === 'official'));
});

test('parseFraction reads whole numbers, fractions and mixed fractions', () => {
  assert.equal(parseFraction('4'), 400);
  assert.equal(parseFraction('3-3/4'), 375);
  assert.equal(parseFraction('5-1/4'), 525);
  assert.equal(parseFraction('1/4'), 25);
});

test('the 16 Sep 2026 statement is a 25 bp hike to 3.75 to 4.00 with a 12 to 0 vote', () => {
  const d = parseFomcStatement(fixture('monetary20260916a.htm'), meeting('US-2026-09-16'));
  assert.deepEqual(d.level, { kind: 'range', lowBps: 375, highBps: 400 });
  assert.equal(d.direction, 'hike');
  assert.equal(d.changeBps, 25);
  assert.deepEqual(d.vote, { for: 12, against: 0, dissents: [] });
  assert.equal(d.announcedAt, '2026-09-16T14:00:00-04:00');
  assert.equal(d.effectiveDate, '2026-09-17');
  assert.equal(d.evidence, 'statement');
  assert.match(d.excerpt ?? '', /^The Committee decided to raise the target range/);
});

test('the 30 Jul 2025 statement is a hold with two named dissents', () => {
  const d = parseFomcStatement(fixture('monetary20250730a.htm'), meeting('US-2025-07-30'));
  assert.deepEqual(d.level, { kind: 'range', lowBps: 425, highBps: 450 });
  assert.equal(d.direction, 'hold');
  assert.equal(d.changeBps, 0);
  assert.deepEqual(d.vote, { for: 9, against: 2, dissents: ['Michelle W. Bowman', 'Christopher J. Waller'] });
});

test('the 10 Dec 2025 statement is a cut with a non-breaking hyphen and three dissents', () => {
  const d = parseFomcStatement(fixture('monetary20251210a.htm'), meeting('US-2025-12-10'));
  assert.deepEqual(d.level, { kind: 'range', lowBps: 350, highBps: 375 });
  assert.equal(d.direction, 'cut');
  assert.equal(d.changeBps, -25);
  assert.deepEqual(d.vote, { for: 9, against: 3, dissents: ['Stephen I. Miran', 'Austan D. Goolsbee', 'Jeffrey R. Schmid'] });
});

test('a statement without the target-range sentence throws SourceParseError', () => {
  const html = fixture('monetary20260916a.htm').replaceAll('target range for the federal funds rate', 'policy stance');
  assert.throws(() => parseFomcStatement(html, meeting('US-2026-09-16')), SourceParseError);
});

test('a statement for a different date throws SourceParseError', () => {
  assert.throws(() => parseFomcStatement(fixture('monetary20260916a.htm'), meeting('US-2026-07-29')), SourceParseError);
});

test('runUs builds a valid release from the fixtures, marking unpublished statements pending', async () => {
  const files: Record<string, string> = {
    'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFEDTAR': fixture('DFEDTAR.csv'),
    'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFEDTARU': fixture('DFEDTARU.csv'),
    'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFEDTARL': fixture('DFEDTARL.csv'),
    'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm': fixture('monetary20260916a.htm'),
    'https://www.federalreserve.gov/newsevents/pressreleases/monetary20250730a.htm': fixture('monetary20250730a.htm'),
    'https://www.federalreserve.gov/newsevents/pressreleases/monetary20251210a.htm': fixture('monetary20251210a.htm'),
  };
  const fetchImpl = (async (url: string) => (url in files ? new Response(files[url], { status: 200 }) : new Response('not found', { status: 404 }))) as typeof fetch;
  const { release, statuses } = await runUs({ now: '2026-10-07T12:00:00Z', fetchImpl });
  assert.deepEqual(validateRelease(release, undefined, COUNTRIES.US.allowlist), []);
  assert.deepEqual(release.decisions.map(d => d.id).sort(), ['US-2025-07-30', 'US-2025-12-10', 'US-2026-09-16']);
  assert.equal(statuses.find(s => s.meetingId === 'US-2026-09-16')?.state, 'verified');
  assert.equal(statuses.find(s => s.meetingId === 'US-2026-07-29')?.state, 'pending');
  assert.equal(release.calendar.find(m => m.id === 'US-2026-09-16')?.status, 'held');
  assert.equal(release.calendar.find(m => m.id === 'US-2026-10-28')?.status, 'scheduled');
  assert.equal(release.coverage.ledgerFrom, '2021-01-27');
});

test('the 27 Jan 2021 statement ("decided to keep") is a hold at 0 to 0.25', () => {
  const d = parseFomcStatement(fixture('monetary20210127a.htm'), meeting('US-2021-01-27'));
  assert.deepEqual(d.level, { kind: 'range', lowBps: 0, highBps: 25 });
  assert.equal(d.direction, 'hold');
  assert.equal(d.changeBps, 0);
  assert.equal(d.vote?.against, 0);
});

test('the 29 Jul 2026 statement keeps the 9 to 3 tally and names all three dissents', () => {
  const d = parseFomcStatement(fixture('monetary20260729a.htm'), meeting('US-2026-07-29'));
  assert.equal(d.direction, 'hold');
  assert.deepEqual(d.vote, { for: 9, against: 3, dissents: ['Beth M. Hammack', 'Neel Kashkari', 'Lorie K. Logan'] });
});

test('a raise without "by X" takes its change from the previous official level', () => {
  const d = parseFomcStatement(fixture('monetary20220316a.htm'), meeting('US-2022-03-16'), 25);
  assert.deepEqual(d.level, { kind: 'range', lowBps: 25, highBps: 50 });
  assert.equal(d.direction, 'hike');
  assert.equal(d.changeBps, 25);
});

test('a raise without "by X" and without a previous level is rejected rather than recorded as zero', () => {
  assert.throws(() => parseFomcStatement(fixture('monetary20220316a.htm'), meeting('US-2022-03-16')), SourceParseError);
});

test('the 18 Dec 2024 statement names its single dissent ("Voting against the action was")', () => {
  const d = parseFomcStatement(fixture('monetary20241218a.htm'), meeting('US-2024-12-18'), 450);
  assert.deepEqual(d.vote, { for: 11, against: 1, dissents: ['Beth M. Hammack'] });
});

test('the 29 Oct 2025 statement names both dissents joined by ", and"', () => {
  const d = parseFomcStatement(fixture('monetary20251029a.htm'), meeting('US-2025-10-29'), 425);
  assert.deepEqual(d.vote, { for: 10, against: 2, dissents: ['Stephen I. Miran', 'Jeffrey R. Schmid'] });
});

test('an unreadable "Voting against" sentence gives no vote rather than a false unanimous one', () => {
  const html = fixture('monetary20250730a.htm').replace('Voting against this action were', 'Voting against, in a departure, were');
  assert.equal(parseFomcStatement(html, meeting('US-2025-07-30')).vote, null);
});
