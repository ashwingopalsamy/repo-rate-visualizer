import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRelease } from '../../schema/invariants.ts';
import { ALLOWLIST_US, baseRelease } from './fixtures.ts';

const codes = (r: ReturnType<typeof baseRelease>, prev?: ReturnType<typeof baseRelease>) =>
  validateRelease(r, prev, ALLOWLIST_US).map(issue => issue.code);

test('the base fixture has no issues', () => {
  assert.deepEqual(codes(baseRelease()), []);
});

test('series not strictly ascending', () => {
  const r = baseRelease();
  r.series.push({ ...r.series[0] });
  assert.ok(codes(r).includes('series-order'));
});

test('decision changeBps disagrees with levels in the same era', () => {
  const r = baseRelease();
  r.decisions[1].changeBps = 50;
  assert.ok(codes(r).includes('change-mismatch'));
});

test('changeBps must be null across an era boundary', () => {
  const r = baseRelease();
  r.eras = [
    { id: 'old', from: '2000-01-01', to: '2026-09-16', instrument: 'Old', kind: 'range', basis: 'policy', note: 'Old era.', sourceId: 'fed-cal' },
    { id: 'new', from: '2026-09-17', to: null, instrument: 'New', kind: 'range', basis: 'policy', note: 'New era.', sourceId: 'fed-cal' },
  ];
  r.decisions[1].eraChange = true;
  assert.ok(codes(r).includes('era-change-bps'));
});

test('hold without a statement', () => {
  const r = baseRelease();
  r.decisions[0].evidence = 'series';
  assert.ok(codes(r).includes('hold-evidence'));
});

test('held meeting after ledgerFrom without exactly one decision', () => {
  const r = baseRelease();
  r.decisions = r.decisions.slice(1);
  assert.ok(codes(r).includes('ledger-gap'));
});

test('cancelled meeting with a decision', () => {
  const r = baseRelease();
  r.calendar[0].status = 'cancelled';
  assert.ok(codes(r).includes('cancelled-decision'));
});

test('decision level differs from series after its effective date', () => {
  const r = baseRelease();
  r.series[1].level = { kind: 'range', lowBps: 400, highBps: 425 };
  assert.ok(codes(r).includes('series-disagrees'));
});

test('unknown sourceId', () => {
  const r = baseRelease();
  r.decisions[1].sourceIds = ['nowhere'];
  assert.ok(codes(r).includes('source-missing'));
});

test('official source off the allowlist', () => {
  const r = baseRelease();
  r.sources[1].url = 'https://example.com/statement';
  assert.ok(codes(r).includes('source-domain'));
});

test('source url containing a query key named key, apikey or token', () => {
  const r = baseRelease();
  r.sources[3].url = 'https://fred.stlouisfed.org/series/DFEDTARU?api_key=abc123';
  assert.ok(codes(r).includes('source-secret'));
});

test('validateRelease rejects a release that rewrites an earlier decision', () => {
  const prev = baseRelease();
  const next = baseRelease();
  next.decisions[0].excerpt = 'Rewritten.';
  assert.ok(codes(next, prev).includes('history-rewrite'));
  next.corrections = [{ recordId: next.decisions[0].id, reason: 'Statement text corrected by the Fed.', sourceId: 'fed-0729' }];
  assert.ok(!codes(next, prev).includes('history-rewrite'));
});

test('release passes when the only difference is an appended decision', () => {
  const prev = baseRelease();
  prev.decisions = prev.decisions.slice(0, 1);
  prev.calendar = prev.calendar.slice(0, 1);
  prev.series = prev.series.slice(0, 1);
  prev.coverage.seriesThrough = '2026-08-01';
  assert.deepEqual(codes(baseRelease(), prev), []);
});
