import type { Meeting } from '../schema/release.ts';
import type { ScheduleFile } from '../schema/files.ts';

/**
 * Every scheduled meeting per country with whether its decision is in the published release. The full calendar is listed
 * (not a rolling window) and generatedAt is the last data change, so the file only changes when data changes.
 */
export function buildSchedule(countries: Record<string, { calendar: Meeting[]; decisions: { meetingId: string | null }[] }>, _now: string, lastChangedAt: string): ScheduleFile {
  const items = Object.entries(countries).flatMap(([cc, { calendar, decisions }]) => {
    const decided = new Set(decisions.map(d => d.meetingId));
    return calendar
      .filter(m => m.status !== 'cancelled' && m.status !== 'moved')
      .map(m => ({ cc, meetingId: m.id, announceAt: m.announceAt, resolved: decided.has(m.id) }));
  }).sort((a, b) => Date.parse(a.announceAt) - Date.parse(b.announceAt) || a.cc.localeCompare(b.cc));
  return { generatedAt: lastChangedAt, items };
}
