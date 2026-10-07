import type { CountryRelease } from '../../schema/release.ts';

/** A small, valid US-like release: one range era, two FOMC meetings, a hold and a hike, official sources. */
export function baseRelease(): CountryRelease {
  return {
    schemaVersion: 3,
    country: { code: 'US', name: 'United States', currency: 'USD', locale: 'en-US', timeZone: 'America/New_York' },
    authority: { name: 'Federal Reserve', short: 'Fed', body: 'Federal Open Market Committee', bodyShort: 'FOMC', url: 'https://www.federalreserve.gov/' },
    instrument: { name: 'Federal funds target range', short: 'Fed funds target', explainer: 'The range the Fed sets for the overnight rate banks charge each other.' },
    eras: [{ id: 'us-range', from: '2008-12-16', to: null, instrument: 'Target range', kind: 'range', basis: 'policy', note: 'Target range since December 2008.', sourceId: 'fed-cal' }],
    calendar: [
      { id: 'US-2026-07-29', date: '2026-07-29', meetingStart: '2026-07-28', announceAt: '2026-07-29T14:00:00-04:00', effectiveLagDays: 1, status: 'held', sourceId: 'fed-cal' },
      { id: 'US-2026-09-16', date: '2026-09-16', meetingStart: '2026-09-15', announceAt: '2026-09-16T14:00:00-04:00', effectiveLagDays: 1, status: 'held', sourceId: 'fed-cal' },
    ],
    decisions: [
      { id: 'US-2026-07-29', meetingId: 'US-2026-07-29', announcedAt: '2026-07-29T14:00:00-04:00', effectiveDate: null, level: { kind: 'range', lowBps: 350, highBps: 375 }, direction: 'hold', changeBps: 0, eraChange: false, offCycle: false, evidence: 'statement', vote: { for: 12, against: 0, dissents: [] }, stance: null, statementUrl: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm', excerpt: null, sourceIds: ['fed-0729'] },
      { id: 'US-2026-09-16', meetingId: 'US-2026-09-16', announcedAt: '2026-09-16T14:00:00-04:00', effectiveDate: '2026-09-17', level: { kind: 'range', lowBps: 375, highBps: 400 }, direction: 'hike', changeBps: 25, eraChange: false, offCycle: false, evidence: 'statement', vote: { for: 11, against: 1, dissents: ['A. Member'] }, stance: null, statementUrl: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm', excerpt: null, sourceIds: ['fed-0916'] },
    ],
    series: [
      { date: '2025-12-11', level: { kind: 'range', lowBps: 350, highBps: 375 }, evidence: 'official', sourceId: 'fred' },
      { date: '2026-09-17', level: { kind: 'range', lowBps: 375, highBps: 400 }, evidence: 'official', sourceId: 'fred' },
    ],
    transmission: [],
    context: [],
    sources: [
      { id: 'fed-cal', type: 'calendar', title: 'FOMC calendars', url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', official: true, publishedAt: null, retrievedAt: null, sha256: null },
      { id: 'fed-0729', type: 'statement', title: 'FOMC statement, 29 Jul 2026', url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm', official: true, publishedAt: '2026-07-29', retrievedAt: null, sha256: null },
      { id: 'fed-0916', type: 'statement', title: 'FOMC statement, 16 Sep 2026', url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm', official: true, publishedAt: '2026-09-16', retrievedAt: null, sha256: null },
      { id: 'fred', type: 'series', title: 'FRED DFEDTARU and DFEDTARL', url: 'https://fred.stlouisfed.org/series/DFEDTARU', official: true, publishedAt: null, retrievedAt: null, sha256: null },
    ],
    coverage: { seriesFrom: '2025-12-11', seriesThrough: '2026-10-06', ledgerFrom: '2026-07-29', grain: 'Every scheduled FOMC meeting from July 2026; target changes from the official series.' },
    corrections: [],
    release: { hash: '', generator: 'tests/pipeline/fixtures' },
  };
}

export const ALLOWLIST_US = ['federalreserve.gov', 'fred.stlouisfed.org'];
