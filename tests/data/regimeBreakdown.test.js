import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRegimeBreakdowns, getYearlyBreakdowns, getAggregateStats } from '../../src/lib/regimeBreakdownData.js';

const TEST_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const snapshot = JSON.parse(readFileSync(resolve(TEST_DIR, '../../src/data/snapshot.json'), 'utf8'));

const decisions = snapshot.decisions.map(d => ({
  ...d,
  dateObj: new Date(`${d.date}T00:00:00.000Z`),
}));

const regimes = snapshot.regimes.map(r => ({
  ...r,
  startObj: new Date(`${r.startDate}T00:00:00.000Z`),
  endObj: new Date(`${r.endDate}T00:00:00.000Z`),
}));

test('regime breakdown computes correct hold-to-move ratios and bps totals', () => {
  const breakdowns = getRegimeBreakdowns(regimes, decisions);
  assert.ok(breakdowns.length > 0, 'should have regime breakdowns');

  const totalDecisionsInBreakdowns = breakdowns.reduce((sum, b) => sum + b.total, 0);
  assert.ok(totalDecisionsInBreakdowns > 0);

  const extendedPause = breakdowns.find(b => b.label.includes('Extended pause'));
  assert.ok(extendedPause, 'Extended pause regime should exist');
  assert.ok(extendedPause.holds >= 10, 'Extended pause should have at least 10 holds');
  assert.ok(extendedPause.ratio.includes(':1'), 'Ratio should format correctly');

  const rajanCycle = breakdowns.find(b => b.label.includes('Rajan'));
  assert.ok(rajanCycle, 'Rajan cycle should exist');
  assert.ok(rajanCycle.cuts > 0, 'Rajan cycle should have cuts');
  assert.ok(rajanCycle.cutBps > 0, 'Rajan cycle should have cut bps');
});

test('yearly breakdown groups decisions by calendar year', () => {
  const yearly = getYearlyBreakdowns(decisions);
  assert.ok(yearly.length > 0, 'should have yearly items');

  const y2024 = yearly.find(y => y.label === '2024');
  assert.ok(y2024, '2024 should exist');
  assert.equal(y2024.holds, 6, '2024 had 6 MPC holds');
  assert.equal(y2024.cuts, 0);
  assert.equal(y2024.hikes, 0);
});

test('aggregate stats correctly summarize whole policy series', () => {
  const stats = getAggregateStats(decisions);
  assert.equal(stats.totalDecisions, decisions.length);
  assert.equal(stats.holdsCount + stats.cutsCount + stats.hikesCount, decisions.length);
  assert.ok(stats.holdPct > 0);
  assert.ok(stats.totalCutBps > 0);
  assert.ok(stats.totalHikeBps > 0);
});
