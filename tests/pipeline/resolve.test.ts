import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMeetings } from '../../pipeline/resolve.ts';
import { COUNTRIES } from '../../pipeline/countries/registry.ts';
import { baseRelease } from './fixtures.ts';

const setup = () => {
  const r = baseRelease();
  const decisions = r.decisions.filter(d => d.id !== 'US-2026-09-16');
  const series = r.series.filter(p => p.date < '2026-09-17');
  return { calendar: r.calendar, decisions, series };
};

test('resolveMeetings keeps a meeting pending while the series lags', () => {
  const { calendar, decisions, series } = setup();
  const { statuses, synthesized } = resolveMeetings(calendar, decisions, series, '2026-09-16', COUNTRIES.US, '2026-09-16T20:00:00Z');
  assert.equal(statuses.find(s => s.meetingId === 'US-2026-09-16')?.state, 'pending');
  assert.deepEqual(synthesized, []);
});

test('resolveMeetings marks a meeting with a statement decision verified', () => {
  const r = baseRelease();
  const { statuses } = resolveMeetings(r.calendar, r.decisions, r.series, '2026-10-06', COUNTRIES.US, '2026-10-07T12:00:00Z');
  assert.equal(statuses.find(s => s.meetingId === 'US-2026-09-16')?.state, 'verified');
  assert.equal(statuses.find(s => s.meetingId === 'US-2026-07-29')?.state, 'verified');
});

test('resolveMeetings synthesises an unchanged decision once a flat series is observed past the effective date', () => {
  const { calendar, decisions, series } = setup();
  const { statuses, synthesized } = resolveMeetings(calendar, decisions, series, '2026-09-17', COUNTRIES.US, '2026-09-18T12:00:00Z');
  assert.equal(statuses.find(s => s.meetingId === 'US-2026-09-16')?.state, 'verified');
  assert.equal(synthesized.length, 1);
  assert.equal(synthesized[0].direction, 'unchanged');
  assert.equal(synthesized[0].evidence, 'series');
  assert.equal(synthesized[0].changeBps, 0);
  assert.deepEqual(synthesized[0].level, { kind: 'range', lowBps: 350, highBps: 375 });
});

test('a country without an independent official series never gets a synthesised unchanged decision', () => {
  const { calendar, decisions, series } = setup();
  const { statuses, synthesized } = resolveMeetings(calendar, decisions, series, '2026-09-30', { ...COUNTRIES.US, independentSeries: false }, '2026-09-30T12:00:00Z');
  assert.equal(statuses.find(s => s.meetingId === 'US-2026-09-16')?.state, 'pending');
  assert.deepEqual(synthesized, []);
});

test('resolveMeetings ignores meetings not yet announced', () => {
  const { calendar, decisions, series } = setup();
  const { statuses } = resolveMeetings(calendar, decisions, series, '2026-09-16', COUNTRIES.US, '2026-09-16T17:59:00Z');
  assert.equal(statuses.find(s => s.meetingId === 'US-2026-09-16'), undefined);
});
