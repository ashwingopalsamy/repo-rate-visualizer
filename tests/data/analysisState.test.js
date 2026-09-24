import test from 'node:test';
import assert from 'node:assert/strict';
import { decisions } from '../../src/data/dataLoader.js';
import { asOfLookup, filterDecisions, windowSummary } from '../../src/lib/analysisState.js';

test('shared analysis filters select action and evidence without mutating the ledger', () => {
  const originalLength = decisions.length;
  const cuts = filterDecisions(decisions, { recordFilters: { action: 'cut', evidence: 'all' } });
  assert.ok(cuts.length > 0);
  assert.ok(cuts.every(decision => decision.action === 'cut'));
  const primary = filterDecisions(decisions, { recordFilters: { action: 'all', evidence: 'primary-decision' } });
  assert.ok(primary.length > 0);
  assert.ok(primary.every(decision => decision.evidenceStatus === 'primary-decision'));
  assert.equal(decisions.length, originalLength);
});

test('as-of lookup distinguishes exact, preceding, and next records', () => {
  const result = asOfLookup(decisions, '2026-08-04');
  assert.equal(result.exact, null);
  assert.equal(result.preceding.date, '2026-06-05');
  assert.equal(result.next.date, '2026-08-05');
});

test('window summary is deterministic and reports the selected window', () => {
  const summary = windowSummary(decisions, { start: '2025-01-01', end: '2026-08-05' });
  assert.equal(summary.first.date, '2025-02-07');
  assert.equal(summary.last.date, '2026-08-05');
  assert.ok(summary.moveCount > 0);
  assert.equal(summary.netBps, -100);
});
