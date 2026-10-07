import test from 'node:test';
import assert from 'node:assert/strict';
import { CountryReleaseSchema } from '../../schema/release.ts';
import { formatLevel } from '../../schema/level.ts';
import { canonicalJson, releaseHash } from '../../schema/hash.ts';
import { baseRelease } from './fixtures.ts';

test('a valid minimal release parses', () => {
  assert.equal(CountryReleaseSchema.safeParse(baseRelease()).success, true);
});

test('a range whose low bound is not below its high bound fails', () => {
  const r = baseRelease();
  r.series[0].level = { kind: 'range', lowBps: 375, highBps: 375 };
  assert.equal(CountryReleaseSchema.safeParse(r).success, false);
});

test('a fractional basis-point value fails', () => {
  const r = baseRelease();
  r.series[0].level = { kind: 'point', bps: 512.5 };
  assert.equal(CountryReleaseSchema.safeParse(r).success, false);
});

test('releaseHash is stable under key reordering', () => {
  const a = baseRelease();
  const reordered = Object.fromEntries(Object.entries(a).reverse()) as typeof a;
  assert.equal(releaseHash(a), releaseHash(reordered));
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
});

test('releaseHash ignores changes inside the release block', () => {
  const a = baseRelease();
  const b = baseRelease();
  b.release = { hash: 'different', generator: 'elsewhere', upstream: { kind: 'x', id: 'y', sha256: 'z' } };
  assert.equal(releaseHash(a), releaseHash(b));
  assert.match(releaseHash(a), /^[0-9a-f]{64}$/);
});

test('formatLevel writes ranges with "to" and both bounds', () => {
  assert.equal(formatLevel({ kind: 'range', lowBps: 375, highBps: 400 }), '3.75 to 4.00%');
  assert.equal(formatLevel({ kind: 'point', bps: 550 }), '5.50%');
  assert.equal(formatLevel({ kind: 'point', bps: -50 }), '−0.50%');
  assert.equal(formatLevel({ kind: 'none', label: 'No policy rate target' }), 'No policy rate target');
});
