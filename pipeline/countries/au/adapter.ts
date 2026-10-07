import type { Observation, SeriesSpec } from '../series.ts';
import { dayMonthYear, pctToBps, splitCsv } from '../series.ts';
import { SourceParseError } from '../../lib/errors.ts';

const SERIES = 'FIRMMCRTD';

/** RBA statistical table F1: metadata rows, a "Series ID" row naming the columns, then "04-Jan-2011,4.75,…" rows. */
export function parseRbaF1(body: string): Observation[] {
  const lines = body.replace(/^﻿/, '').split(/\r?\n/);
  const idRow = lines.find(l => l.startsWith('Series ID,'));
  const col = idRow ? splitCsv(idRow).indexOf(SERIES) : -1;
  if (col < 0) throw new SourceParseError(`RBA F1 table has no ${SERIES} column`);
  return lines.flatMap(line => {
    const cells = splitCsv(line);
    const date = dayMonthYear(cells[0] ?? '');
    return date && cells[col]?.trim() ? [{ date, bps: pctToBps(cells[col], `RBA ${date}`) }] : [];
  });
}

export const rba: SeriesSpec = {
  code: 'AU',
  urls: () => ['https://www.rba.gov.au/statistics/tables/csv/f1-data.csv'],
  parse: parseRbaF1,
  source: { id: 'au-rba-f1', title: `RBA statistical table F1: Cash Rate Target (${SERIES})`, url: 'https://www.rba.gov.au/statistics/tables/csv/f1-data.csv' },
  era: { id: 'au-cash-rate', instrument: 'Cash rate target', note: 'The RBA target for overnight interbank loans; table F1 carries the daily series from January 2011.' },
  grain: 'Every change in the cash rate target from RBA table F1 (daily series from January 2011). Decision records are being added.',
};
