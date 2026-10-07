import type { Observation, SeriesSpec } from '../series.ts';
import { dayMonthYear, pctToBps, splitCsv } from '../series.ts';
import { SourceParseError } from '../../lib/errors.ts';

/** Bank of England IADB CSV: a DATE,IUDBEDR header, then "04 Jan 2000,5.5" rows. */
export function parseBoeCsv(body: string): Observation[] {
  const [header, ...rows] = body.trim().split(/\r?\n/);
  if (!header || splitCsv(header)[1]?.trim() !== 'IUDBEDR') throw new SourceParseError('Bank of England CSV header does not name IUDBEDR');
  return rows.flatMap(row => {
    const [day, value] = splitCsv(row);
    const date = dayMonthYear(day ?? '');
    return date && value ? [{ date, bps: pctToBps(value, `BoE ${date}`) }] : [];
  });
}

export const boe: SeriesSpec = {
  code: 'GB',
  urls: () => ['https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=01/Jan/1999&Dateto=now&SeriesCodes=IUDBEDR&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N'],
  parse: parseBoeCsv,
  source: { id: 'gb-boe-iudbedr', title: 'Bank of England database: Official Bank Rate (IUDBEDR)', url: 'https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp' },
  era: { id: 'gb-bank-rate', instrument: 'Bank Rate', note: 'The rate the Bank of England pays on commercial bank reserves.' },
  grain: 'Every change in Bank Rate from the Bank of England database (daily series). Decision records and votes are being added.',
};
