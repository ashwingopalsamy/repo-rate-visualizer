import type { Observation, SeriesSpec } from '../series.ts';
import { pctToBps, splitCsv } from '../series.ts';
import { SourceParseError } from '../../lib/errors.ts';

const SERIES = 'FM.D.U2.EUR.4F.KR.DFR.LEV';

/** ECB Data Portal csvdata: one row per day with TIME_PERIOD and OBS_VALUE columns. */
export function parseEcbCsv(body: string): Observation[] {
  const [header, ...rows] = body.replace(/^﻿/, '').trim().split(/\r?\n/);
  const cols = splitCsv(header ?? '');
  const t = cols.indexOf('TIME_PERIOD'), v = cols.indexOf('OBS_VALUE');
  if (t < 0 || v < 0) throw new SourceParseError('ECB CSV has no TIME_PERIOD and OBS_VALUE columns');
  return rows.flatMap(row => {
    const cells = splitCsv(row);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cells[t] ?? '') || !cells[v]) return [];
    return [{ date: cells[t], bps: pctToBps(cells[v], `ECB ${cells[t]}`) }];
  });
}

export const ecb: SeriesSpec = {
  code: 'EA',
  urls: () => [`https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV?format=csvdata&detail=dataonly&startPeriod=1999-01-01`],
  parse: parseEcbCsv,
  source: { id: 'ea-ecb-dfr', title: `ECB Data Portal: Deposit facility rate (${SERIES})`, url: `https://data.ecb.europa.eu/data/datasets/FM/${SERIES}` },
  era: { id: 'ea-dfr', instrument: 'Deposit facility rate', note: 'The rate on overnight deposits with the Eurosystem, the rate through which the ECB steers policy.' },
  grain: 'Every change in the deposit facility rate from the ECB Data Portal (dates of change). Decision records and votes are being added.',
};
