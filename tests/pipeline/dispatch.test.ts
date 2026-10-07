import test from 'node:test';
import assert from 'node:assert/strict';
import { dueDispatches, LADDER_MIN } from '../../worker/dispatch/plan.ts';
import type { ScheduleFile } from '../../schema/files.ts';

const T = '2026-09-16T14:00:00-04:00'; // 18:00 UTC
const at = (minutes: number) => new Date(Date.parse(T) + minutes * 60_000).toISOString();
const schedule = (items: ScheduleFile['items']): ScheduleFile => ({ generatedAt: '2026-09-01T00:00:00Z', items });
const fomc = { cc: 'US', meetingId: 'US-2026-09-16', announceAt: T, resolved: false };

test('the ladder is 10, 25, 45, 90, 180 and 360 minutes', () => {
  assert.deepEqual(LADDER_MIN, [10, 25, 45, 90, 180, 360]);
});

test('dueDispatches fires once per ladder rung', () => {
  for (const m of [10, 25, 45, 90, 180, 360]) {
    assert.deepEqual(dueDispatches(schedule([fomc]), at(m)), { countries: ['US'], reason: 'ladder:US-2026-09-16' }, `+${m}m`);
  }
  for (const m of [5, 20, 40, 60, 100, 400]) assert.equal(dueDispatches(schedule([fomc]), at(m)), null, `+${m}m`);
  // Over the cron's real ticks (every 10 minutes, on the hour), each rung fires exactly once: 6 dispatches in 7 hours.
  for (const offset of [0, 15]) {
    const announceAt = new Date(Date.parse(T) + offset * 60_000).toISOString();
    const ticks = Array.from({ length: 43 }, (_, i) => new Date(Date.parse(T) + i * 10 * 60_000).toISOString());
    const fired = ticks.filter(t => dueDispatches(schedule([{ ...fomc, announceAt }]), t) !== null).length;
    assert.equal(fired, 6, `announcement at :${String(offset).padStart(2, '0')}`);
  }
});

test('a resolved meeting never dispatches', () => {
  assert.equal(dueDispatches(schedule([{ ...fomc, resolved: true }]), at(10)), null);
});

test('two countries due on the same tick merge into one dispatch', () => {
  const rbi = { cc: 'IN', meetingId: 'IN-2026-09-17', announceAt: '2026-09-16T23:30:00+05:30', resolved: false }; // 18:00 UTC
  assert.deepEqual(dueDispatches(schedule([fomc, rbi]), at(10)), { countries: ['IN', 'US'], reason: 'ladder:IN-2026-09-17,US-2026-09-16' });
});

test('dueDispatches handles a DST transition', () => {
  const march = { cc: 'US', meetingId: 'US-2027-03-17', announceAt: '2027-03-17T14:00:00-04:00', resolved: false };
  assert.deepEqual(dueDispatches(schedule([march]), '2027-03-17T18:10:00.000Z'), { countries: ['US'], reason: 'ladder:US-2027-03-17' });
  assert.equal(dueDispatches(schedule([march]), '2027-03-17T19:10:00.000Z'), null);
});
