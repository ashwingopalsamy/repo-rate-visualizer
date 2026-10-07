import type { Observation, SeriesSpec } from '../series.ts';
import { pctToBps } from '../series.ts';
import { SourceParseError } from '../../lib/errors.ts';

const SERIES = 'V39079';

/** Bank of Canada Valet JSON: observations [{ d: "2009-04-21", V39079: { v: "0.25" } }]. */
export function parseValetJson(body: string): Observation[] {
  let doc: { observations?: { d?: string; [k: string]: unknown }[] };
  try { doc = JSON.parse(body); } catch (error) { throw new SourceParseError('Bank of Canada Valet response is not JSON', { cause: error }); }
  if (!Array.isArray(doc.observations)) throw new SourceParseError('Bank of Canada Valet response has no observations');
  return doc.observations.flatMap(o => {
    const cell = o[SERIES] as { v?: string } | undefined;
    if (!o.d || !/^\d{4}-\d{2}-\d{2}$/.test(o.d) || !cell?.v) return [];
    return [{ date: o.d, bps: pctToBps(cell.v, `BoC ${o.d}`) }];
  });
}

export const boc: SeriesSpec = {
  code: 'CA',
  urls: () => [`https://www.bankofcanada.ca/valet/observations/${SERIES}/json`],
  parse: parseValetJson,
  source: { id: 'ca-boc-v39079', title: `Bank of Canada Valet: Target for the overnight rate (${SERIES})`, url: `https://www.bankofcanada.ca/valet/observations/${SERIES}` },
  era: { id: 'ca-overnight-target', instrument: 'Target for the overnight rate', note: 'The Bank of Canada policy rate; the daily Valet series starts in April 2009.' },
  grain: 'Every change in the overnight rate target from Bank of Canada Valet (daily series from April 2009). Decision records are being added.',
};
