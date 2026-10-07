import test from 'node:test';
import assert from 'node:assert/strict';
import { minutesBetween, plainDate, zonedInstant } from '../../pipeline/lib/time.ts';

test('zonedInstant uses the IST offset', () => {
  assert.equal(zonedInstant('2026-10-07', '10:00', 'Asia/Kolkata'), '2026-10-07T10:00:00+05:30');
});

test('zonedInstant uses the daylight offset in New York in March', () => {
  assert.equal(zonedInstant('2026-03-18', '14:00', 'America/New_York'), '2026-03-18T14:00:00-04:00');
});

test('zonedInstant uses the standard offset in New York in January', () => {
  assert.equal(zonedInstant('2026-01-28', '14:00', 'America/New_York'), '2026-01-28T14:00:00-05:00');
});

test('minutesBetween compares instants across offsets', () => {
  assert.equal(minutesBetween('2026-10-07T10:00:00+05:30', '2026-10-07T04:40:00Z'), 10);
});

test('plainDate keeps the calendar date of a zoned instant', () => {
  assert.equal(plainDate('2026-10-07T23:30:00-04:00'), '2026-10-07');
});
