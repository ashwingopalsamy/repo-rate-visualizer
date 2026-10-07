import type { ScheduleFile } from '../../schema/files.ts';
import { minutesBetween } from '../../pipeline/lib/time.ts';

/** Minutes after an announcement at which an unresolved meeting is retried. */
export const LADDER_MIN = [10, 25, 45, 90, 180, 360];
/** The cron interval; each rung owns exactly one tick-wide window, so it fires once. */
export const TICK_MIN = 10;

export type Dispatch = { countries: string[]; reason: string };

/** The refresh to dispatch at `nowIso`, merging every country whose unresolved meeting sits on a ladder rung; null when none. */
export function dueDispatches(schedule: ScheduleFile, nowIso: string): Dispatch | null {
  const due = schedule.items.filter(item => {
    if (item.resolved) return false;
    const elapsed = minutesBetween(item.announceAt, nowIso);
    return LADDER_MIN.some(rung => elapsed >= rung && elapsed < rung + TICK_MIN);
  });
  if (!due.length) return null;
  const countries = [...new Set(due.map(i => i.cc))].sort();
  return { countries, reason: `ladder:${due.map(i => i.meetingId).sort().join(',')}` };
}
