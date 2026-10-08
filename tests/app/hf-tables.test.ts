import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTables, loadCountries } from '../../scripts/hf/tables.ts';
import type { Row } from '../../scripts/hf/tables.ts';

const xs = loadCountries(), tables = buildTables(xs), rows = (name: string) => tables.find(t => t.name === name)!.rows;
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

test('every row carries exactly its declared columns', () => {
  for (const t of tables) for (const r of t.rows) assert.deepEqual(Object.keys(r), t.columns.map(c => c.name), t.name);
});

test('India’s cycles are the site’s: five earlier tightening cycles, median 250 bps over about nine months', () => {
  const india = rows('cycles').filter(r => r.country_code === 'IN'), cur = india.at(-1)!;
  assert.equal(cur.direction, 'tightening');
  assert.equal(cur.is_current, true);
  const past = india.slice(0, -1).filter(r => r.direction === cur.direction && (r.moves as number) >= 2);
  assert.equal(past.length, 5);
  assert.equal(median(past.map(r => r.total_bps as number)), 250);
  assert.equal(Math.round(median(past.map(r => r.days as number)) / 30.44), 9);
});

test('rates has one row per series point, and the US range era starts with a null change', () => {
  assert.equal(rows('rates').length, xs.reduce((n, x) => n + x.release.series.length, 0));
  const us = rows('rates').find(r => r.country_code === 'US' && r.effective_date === '2008-12-16') as Row;
  assert.deepEqual([us.level_kind, us.rate_low_pct, us.rate_high_pct, us.change_bps, us.direction], ['range', 0, 0.25, null, 'era_change']);
});

test('decisions keep holds and votes', () => {
  const d = rows('decisions').find(r => r.decision_id === 'IN-2026-08-05')!;
  assert.deepEqual([d.direction, d.change_bps, d.rate_pct, d.vote_for, d.vote_against, d.unanimous], ['hold', 0, 5.25, 6, 0, true]);
  assert.equal(rows('decisions').filter(r => r.country_code === 'IN').length, 62);
  assert.equal(rows('decisions').filter(r => r.country_code === 'US').length, 46);
});
