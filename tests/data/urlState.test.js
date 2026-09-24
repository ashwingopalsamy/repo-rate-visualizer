import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUrlState, serializeUrlState } from '../../src/hooks/useUrlState.js';

test('URL state round-trips shared analytical state', () => {
  const query = serializeUrlState({
    activeView: 'timeline',
    activePreset: 'CUSTOM',
    dateRange: { start: '2020-01-01', end: '2025-12-31' },
    layers: { regimes: false, events: true },
    activeDecisionId: 'decision-2025-12-05-reuters',
    cycleSelection: { a: '2', b: '4' },
    recordFilters: { action: 'cut', evidence: 'historical-secondary' },
    timelineMode: 'changes',
    rateChangeState: { sizeBand: '26-50', sort: 'magnitude', view: 'cumulative' },
    breakdownState: { group: 'year', metric: 'bps' },
    comparison: { aStart: '2020-01-01', aEnd: '2025-12-31', bStart: '2015-01-01', bEnd: '2019-12-31' },
  });
  const parsed = parseUrlState(`?${query}`);

  assert.deepEqual(parsed.dateRange, { start: '2020-01-01', end: '2025-12-31' });
  assert.deepEqual(parsed.layers, { regimes: false, events: true });
  assert.equal(parsed.activeDecisionId, 'decision-2025-12-05-reuters');
  assert.equal(parsed.cycleA, '2');
  assert.equal(parsed.cycleB, '4');
  assert.deepEqual(parsed.recordFilters, { action: 'cut', evidence: 'historical-secondary' });
  assert.equal(parsed.timelineMode, 'changes');
  assert.deepEqual(parsed.rateChangeState, { sizeBand: '26-50', sort: 'magnitude', view: 'cumulative' });
  assert.deepEqual(parsed.breakdownState, { group: 'year', metric: 'bps' });
  assert.deepEqual(parsed.comparison, { aStart: '2020-01-01', aEnd: '2025-12-31', bStart: '2015-01-01', bEnd: '2019-12-31' });
});

test('URL state normalizes MAX and rejects malformed custom dates', () => {
  const max = parseUrlState('?view=cycles&range=MAX');
  assert.equal(max.activePreset, 'ALL');

  const malformed = parseUrlState('?range=CUSTOM&start=2025-02-30&end=2025-01-01');
  assert.deepEqual(malformed.dateRange, { start: null, end: null });
  assert.equal(malformed.activePreset, 'ALL');
  assert.equal(parseUrlState('?decision=missing-record&a=999&b=-1').activeDecisionId, null);
});
