import { existsSync, readFileSync } from 'node:fs';
import type { Meeting, Source, Transmission } from '../../schema/release.ts';
import { zonedInstant } from '../lib/time.ts';

export type CountryCode = 'IN' | 'US' | 'EA' | 'GB' | 'CA' | 'AU' | 'BR';

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
  // Series-only countries: the official level series, no decision records or calendar yet (daily sweep keeps them current).
  EA: {
    code: 'EA', name: 'Euro area', currency: 'EUR', locale: 'en-IE', timeZone: 'Europe/Berlin',
    authority: { name: 'European Central Bank', short: 'ECB', body: 'Governing Council', bodyShort: 'Governing Council', url: 'https://www.ecb.europa.eu/' },
    instrument: {
      name: 'Deposit facility rate', short: 'Deposit rate',
      explainer: 'The deposit facility rate is what banks earn on overnight deposits with the Eurosystem. The ECB steers its policy stance through it, and the Governing Council sets it about every six weeks to keep euro-area inflation at 2% over the medium term.',
    },
    allowlist: ['ecb.europa.eu'], effectiveLagDays: 6, announceTime: '14:15', independentSeries: true,
  },
  GB: {
    code: 'GB', name: 'United Kingdom', currency: 'GBP', locale: 'en-GB', timeZone: 'Europe/London',
    authority: { name: 'Bank of England', short: 'BoE', body: 'Monetary Policy Committee', bodyShort: 'MPC', url: 'https://www.bankofengland.co.uk/' },
    instrument: {
      name: 'Bank Rate', short: 'Bank Rate',
      explainer: 'Bank Rate is what the Bank of England pays on reserves held by commercial banks. The Monetary Policy Committee sets it eight times a year to meet the 2% inflation target, and tracker mortgages follow it directly.',
    },
    allowlist: ['bankofengland.co.uk'], effectiveLagDays: 0, announceTime: '12:00', independentSeries: true,
  },
  CA: {
    code: 'CA', name: 'Canada', currency: 'CAD', locale: 'en-CA', timeZone: 'America/Toronto',
    authority: { name: 'Bank of Canada', short: 'BoC', body: 'Governing Council', bodyShort: 'Governing Council', url: 'https://www.bankofcanada.ca/' },
    instrument: {
      name: 'Target for the overnight rate', short: 'Policy rate',
      explainer: 'The target for the overnight rate is the rate the Bank of Canada wants for overnight lending between major financial institutions. It is set eight times a year to keep inflation near 2%, and lenders\' prime rates move with it.',
    },
    allowlist: ['bankofcanada.ca'], effectiveLagDays: 1, announceTime: '09:45', independentSeries: true,
  },
  AU: {
    code: 'AU', name: 'Australia', currency: 'AUD', locale: 'en-AU', timeZone: 'Australia/Sydney',
    authority: { name: 'Reserve Bank of Australia', short: 'RBA', body: 'Monetary Policy Board', bodyShort: 'Monetary Policy Board', url: 'https://www.rba.gov.au/' },
    instrument: {
      name: 'Cash rate target', short: 'Cash rate',
      explainer: 'The cash rate target is the RBA\'s target for the rate on overnight loans between banks. The Monetary Policy Board sets it eight times a year to keep inflation between 2 and 3%, and most home loans in Australia are variable and follow it.',
    },
    allowlist: ['rba.gov.au'], effectiveLagDays: 1, announceTime: '14:30', independentSeries: true,
  },
  BR: {
    code: 'BR', name: 'Brazil', currency: 'BRL', locale: 'pt-BR', timeZone: 'America/Sao_Paulo',
    authority: { name: 'Banco Central do Brasil', short: 'BCB', body: 'Monetary Policy Committee (Copom)', bodyShort: 'Copom', url: 'https://www.bcb.gov.br/' },
    instrument: {
      name: 'Selic target', short: 'Selic',
      explainer: 'The Selic target is the rate the Banco Central do Brasil aims for in overnight trading of government bonds. Copom sets it eight times a year to meet the national inflation target, and floating-rate credit and CDI-linked savings follow it closely.',
    },
    allowlist: ['bcb.gov.br'], effectiveLagDays: 1, announceTime: '18:30', independentSeries: true,
  },
};

type SourceEntry = { id: string; type: string; title: string; url: string };
type CalendarEntry = { id: string; date: string; meetingStart: string | null; status: Meeting['status']; movedTo?: string; sourceId: string };

const readJson = <T>(relative: string): T => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8')) as T;
// Countries without a published calendar yet have no calendar file; they have no meetings and cite no calendar source.
const calendarFile = (code: CountryCode): { sources: SourceEntry[]; meetings: CalendarEntry[] } => {
  const path = `../calendars/${code.toLowerCase()}.json`;
  return existsSync(new URL(path, import.meta.url)) ? readJson(path) : { sources: [], meetings: [] };
};
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
