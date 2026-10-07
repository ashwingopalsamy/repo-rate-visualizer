import { readFileSync } from 'node:fs';
import type { Meeting, Source, Transmission } from '../../schema/release.ts';
import { zonedInstant } from '../lib/time.ts';

export type CountryCode = 'IN' | 'US';

export type CountryProfile = {
  code: CountryCode;
  name: string;
  currency: string;
  locale: string;
  timeZone: string;
  authority: { name: string; short: string; body: string; bodyShort: string; url: string };
  instrument: { name: string; short: string; explainer: string };
  allowlist: string[];
  effectiveLagDays: number;
  announceTime: string;
  /** True when an official level series exists independently of the decision statements (needed to infer an unchanged meeting). */
  independentSeries: boolean;
};

export const COUNTRIES: Record<CountryCode, CountryProfile> = {
  IN: {
    code: 'IN', name: 'India', currency: 'INR', locale: 'en-IN', timeZone: 'Asia/Kolkata',
    authority: { name: 'Reserve Bank of India', short: 'RBI', body: 'Monetary Policy Committee', bodyShort: 'MPC', url: 'https://www.rbi.org.in/' },
    instrument: {
      name: 'Policy repo rate', short: 'Repo rate',
      explainer: 'The repo rate is the rate at which the Reserve Bank of India lends overnight to banks against government securities. The Monetary Policy Committee sets it six times a year to keep inflation close to its 4% target. Most new floating-rate retail loans are priced off it.',
    },
    allowlist: ['rbi.org.in', 'rbidocs.rbi.org.in', 'website.rbi.org.in'],
    effectiveLagDays: 0, announceTime: '10:00', independentSeries: false,
  },
  US: {
    code: 'US', name: 'United States', currency: 'USD', locale: 'en-US', timeZone: 'America/New_York',
    authority: { name: 'Federal Reserve', short: 'Fed', body: 'Federal Open Market Committee', bodyShort: 'FOMC', url: 'https://www.federalreserve.gov/' },
    instrument: {
      name: 'Federal funds target range', short: 'Fed funds target',
      explainer: 'The federal funds target range is where the Federal Reserve wants the overnight rate between banks to trade. The Federal Open Market Committee sets it eight times a year in pursuit of maximum employment and 2% inflation. Prime-linked borrowing moves with it almost at once.',
    },
    allowlist: ['federalreserve.gov', 'fred.stlouisfed.org'],
    effectiveLagDays: 1, announceTime: '14:00', independentSeries: true,
  },
};

type SourceEntry = { id: string; type: string; title: string; url: string };
type CalendarEntry = { id: string; date: string; meetingStart: string | null; status: Meeting['status']; movedTo?: string; sourceId: string };

const readJson = <T>(relative: string): T => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8')) as T;
const calendarFile = (code: CountryCode) => readJson<{ sources: SourceEntry[]; meetings: CalendarEntry[] }>(`../calendars/${code.toLowerCase()}.json`);
const transmissionFile = (code: CountryCode) => readJson<{ sources: SourceEntry[]; entries: Transmission[] }>(`../transmission/${code.toLowerCase()}.json`);

/** Scheduled meetings with announceAt resolved to the authority's local announcement time on the decision date. */
export function loadCalendar(code: CountryCode): Meeting[] {
  const profile = COUNTRIES[code];
  return calendarFile(code).meetings.map(entry => ({
    ...entry,
    announceAt: zonedInstant(entry.date, profile.announceTime, profile.timeZone),
    effectiveLagDays: profile.effectiveLagDays,
  }));
}

export function loadTransmission(code: CountryCode): Transmission[] {
  return transmissionFile(code).entries;
}

/** Official sources cited by the calendar and transmission files. */
export function loadSources(code: CountryCode): Source[] {
  const toSource = (s: SourceEntry): Source => ({ ...s, official: true, publishedAt: null, retrievedAt: null, sha256: null });
  return [...calendarFile(code).sources, ...transmissionFile(code).sources].map(toSource);
}
