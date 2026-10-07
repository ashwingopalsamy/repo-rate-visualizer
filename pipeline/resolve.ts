import type { Decision, Meeting, SeriesPoint } from '../schema/release.ts';
import { sameLevel } from '../schema/level.ts';
import type { CountryProfile } from './countries/registry.ts';
import { addDays, minutesBetween } from './lib/time.ts';
import type { MeetingStatus } from './types.ts';

const levelAt = (series: SeriesPoint[], date: string) => [...series].reverse().find(p => p.date <= date);

/**
 * Status of every announced meeting (spec §3 invariants 4-5, §5): verified when a decision exists; an "unchanged" decision is
 * synthesised only when no statement was parsed and the official series is observed flat on or after the effective date.
 */
export function resolveMeetings(
  calendar: Meeting[], decisions: Decision[], series: SeriesPoint[], seriesThrough: string,
  _profile: CountryProfile, now: string, ledgerFrom: string | null = null,
): { statuses: MeetingStatus[]; synthesized: Decision[] } {
  const statuses: MeetingStatus[] = [];
  const synthesized: Decision[] = [];
  const decided = new Set(decisions.map(d => d.meetingId));
  for (const meeting of calendar) {
    if (meeting.status === 'cancelled' || meeting.status === 'moved') continue;
    if (minutesBetween(meeting.announceAt, now) < 0) continue;
    if (ledgerFrom && meeting.date < ledgerFrom) continue;
    if (decided.has(meeting.id)) { statuses.push({ meetingId: meeting.id, state: 'verified' }); continue; }
    const effective = addDays(meeting.date, meeting.effectiveLagDays);
    if (seriesThrough < effective) { statuses.push({ meetingId: meeting.id, state: 'pending', detail: 'Waiting for the official release' }); continue; }
    const before = levelAt(series, addDays(meeting.date, -1));
    const after = levelAt(series, effective);
    if (before && after && after.evidence === 'official' && sameLevel(before.level, after.level)) {
      synthesized.push({
        id: meeting.id, meetingId: meeting.id, announcedAt: meeting.announceAt, effectiveDate: effective, level: after.level,
        direction: 'unchanged', changeBps: 0, eraChange: false, offCycle: false, evidence: 'series',
        vote: null, stance: null, statementUrl: null, excerpt: null, sourceIds: [after.sourceId],
      });
      statuses.push({ meetingId: meeting.id, state: 'verified', detail: 'Unchanged per the official series; no statement parsed' });
    } else {
      statuses.push({ meetingId: meeting.id, state: 'pending', detail: 'The series moved but no statement has been parsed yet' });
    }
  }
  return { statuses, synthesized };
}
