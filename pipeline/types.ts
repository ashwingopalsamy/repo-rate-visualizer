import type { CountryRelease } from '../schema/release.ts';

export type MeetingStatus = { meetingId: string; state: 'verified' | 'pending' | 'failed'; detail?: string };
export type RunContext = { now: string; fetchImpl?: typeof fetch; previous?: CountryRelease };
export type CountryResult = { release: CountryRelease; statuses: MeetingStatus[] };
