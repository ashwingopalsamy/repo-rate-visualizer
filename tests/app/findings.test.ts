import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAtlas } from '../../scripts/build-atlas.ts';
import { initAtlas, lede, levelInfo, cycleInfo, gapInfo, emi, monthsFor, pct, peers, stanceOfPlay, MODEL, CODES, vText } from '../../src/lib/atlas.ts';

initAtlas(buildAtlas(), '2026-10-07');
const strip = (h: string) => h.replace(/<[^>]+>/g, '');

test('all seven countries are modelled from the published releases', () => {
  assert.deepEqual(CODES, ['IN', 'US', 'EA', 'GB', 'CA', 'AU', 'BR']);
  assert.equal(vText(MODEL.IN.last), '5.50%');
  assert.equal(vText(MODEL.US.last), '3.75 to 4.00%');
  assert.equal(vText(MODEL.EA.last), '2.50%');
});

test('the India lede names the move, its context and the hold before it', () => {
  assert.equal(strip(lede('IN')), 'The RBI raised the policy repo rate by 25 bps to 5.50% on 7 Oct 2026, its first hike since February 2023, after ten months unchanged at 5.25%.');
});

test('India level, cycle and gap findings match the pinned values', () => {
  const L = levelInfo('IN');
  assert.ok(L.pBelow < L.pAbove);
  assert.equal(Math.round(L.pAbove * 100), 72);
  const C = cycleInfo('IN');
  assert.equal(C.past.length, 5);
  assert.equal(C.medTotal, 250);
  assert.equal(Math.round((C.medDays ?? 0) / 30.44), 9);
  const G = gapInfo('IN');
  assert.equal(G.s, 150);
  assert.equal(G.yearAgo, 125);
  assert.equal(G.rel.word, 'narrower');
  assert.equal(Math.round(G.rel.share * 100), 85);
  assert.equal(G.since, null);
});

test('loan arithmetic: a 25 bp hike on a 50 lakh, 20-year, 8.5% loan', () => {
  const n = 240, p0 = emi(5000000, 8.5, n), p1 = emi(5000000, 8.75, n);
  assert.ok(Math.abs(p0 - 43391.16) < 0.01, String(p0));
  assert.ok(Math.abs(p1 - 44185.54) < 0.01, String(p1));
  assert.ok(Math.abs(p1 - p0 - 794.37) < 0.01);
  assert.equal(Math.round(monthsFor(5000000, 8.75, p0) - n), 12);
  assert.ok(Math.abs((p1 - p0) * n - 190649.71) < 1);
});

test('negative rates format with a true minus sign; peers rank by level', () => {
  assert.equal(pct(-50), '−0.50');
  assert.equal(peers('IN').rank, 2);
  assert.equal(stanceOfPlay('GB').cls, 'hold');
});
