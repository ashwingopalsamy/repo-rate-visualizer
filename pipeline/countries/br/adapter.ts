import type { Observation, SeriesSpec } from '../series.ts';
import { pctToBps } from '../series.ts';
import { SourceParseError } from '../../lib/errors.ts';

const API = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json';
const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** SGS caps a daily-series query at ten years, so ask in five-year windows from 2000 to today. */
export function sgsUrls(today: string): string[] {
  const urls: string[] = [];
  for (let year = 2000; year <= Number(today.slice(0, 4)); year += 5) {
    const end = `${year + 4}-12-31` < today ? `${year + 4}-12-31` : today;
    urls.push(`${API}&dataInicial=01/01/${year}&dataFinal=${ddmmyyyy(end)}`);
  }
  return urls;
}

/** BCB SGS JSON: [{ "data": "07/10/2026", "valor": "13.75" }]. */
export function parseSgsJson(body: string): Observation[] {
  let rows: unknown;
  try { rows = JSON.parse(body); } catch (error) { throw new SourceParseError('BCB SGS response is not JSON', { cause: error }); }
  if (!Array.isArray(rows)) throw new SourceParseError('BCB SGS response is not a list of observations');
  return rows.flatMap(row => {
    const { data, valor } = row as { data?: string; valor?: string };
    const m = data?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m || !valor) return [];
    const date = `${m[3]}-${m[2]}-${m[1]}`;
    return [{ date, bps: pctToBps(valor, `BCB ${date}`) }];
  });
}

export const bcb: SeriesSpec = {
  code: 'BR',
  urls: sgsUrls,
  parse: parseSgsJson,
  source: { id: 'br-bcb-sgs432', title: 'Banco Central do Brasil SGS: Selic target (series 432)', url: API },
  era: { id: 'br-selic-target', instrument: 'Selic target', note: 'The Copom target for the overnight Selic rate.' },
  grain: 'Every change in the Selic target from BCB SGS series 432 (daily). Decision records are being added.',
};
