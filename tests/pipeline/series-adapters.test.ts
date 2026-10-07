import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COUNTRIES, loadSources, loadTransmission } from '../../pipeline/countries/registry.ts';
import { SERIES_ADAPTERS, changePoints } from '../../pipeline/countries/series.ts';
import { parseEcbCsv } from '../../pipeline/countries/ea/adapter.ts';
import { parseBoeCsv } from '../../pipeline/countries/gb/adapter.ts';
import { parseValetJson } from '../../pipeline/countries/ca/adapter.ts';
import { parseRbaF1 } from '../../pipeline/countries/au/adapter.ts';
import { parseSgsJson, sgsUrls } from '../../pipeline/countries/br/adapter.ts';
import { validateRelease } from '../../schema/invariants.ts';
import { SourceParseError } from '../../pipeline/lib/errors.ts';

const fixture = (path: string) => readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8');

/** Answers each request with the fixture whose key appears in the URL; anything else is a 404. */
const stubFetch = (routes: Record<string, string>): typeof fetch => (async (input: string | URL | Request) => {
  const url = String(input);
  const hit = Object.entries(routes).find(([key]) => url.includes(key));
  return hit ? new Response(fixture(hit[1]), { status: 200 }) : new Response('not found', { status: 404 });
}) as typeof fetch;

const CASES = [
  { code: 'EA', routes: { 'data-api.ecb.europa.eu': 'ea/dfr.csv' }, latest: 250, latestDate: '2026-09-16', through: '2026-10-07' },
  { code: 'GB', routes: { 'bankofengland.co.uk': 'gb/bankrate.csv' }, latest: 375, latestDate: '2025-12-18', through: '2026-10-05' },
  { code: 'CA', routes: { 'bankofcanada.ca': 'ca/v39079.json' }, latest: 225, latestDate: '2025-10-30', through: null },
  { code: 'AU', routes: { 'rba.gov.au': 'au/f1-data.csv' }, latest: 460, latestDate: '2026-09-30', through: null },
  { code: 'BR', routes: { 'dataInicial=01/01/2020': 'br/sgs432-b.json', 'bcb.gov.br': 'br/sgs432-a.json' }, latest: 1375, latestDate: '2026-09-17', through: '2026-10-07' },
] as const;

test('parsers read each official format into basis-point observations', () => {
  assert.deepEqual(parseEcbCsv(fixture('ea/dfr.csv')).at(-1), { date: '2026-10-07', bps: 250 });
  assert.deepEqual(parseBoeCsv(fixture('gb/bankrate.csv')).at(0), { date: '2024-01-02', bps: 525 });
  assert.equal(parseValetJson(fixture('ca/v39079.json')).at(-1)?.bps, 225);
  assert.equal(parseRbaF1(fixture('au/f1-data.csv')).at(-1)?.bps, 460);
  assert.deepEqual(parseSgsJson(fixture('br/sgs432-b.json')).at(-1), { date: '2026-10-07', bps: 1375 });
});

test('parsers fail closed on a payload that is not the expected format', () => {
  for (const parse of [parseEcbCsv, parseBoeCsv, parseValetJson, parseRbaF1, parseSgsJson]) {
    assert.throws(() => parse('<html><title>Access Denied</title></html>'), SourceParseError);
  }
});

test('changePoints keeps only level changes and starts from the last change on or before the history start', () => {
  const obs = [{ date: '1999-11-05', bps: 200 }, { date: '1999-12-31', bps: 200 }, { date: '2000-01-03', bps: 200 }, { date: '2000-02-04', bps: 225 }, { date: '2000-02-07', bps: 225 }];
  assert.deepEqual(changePoints(obs, '2000-01-01').map(p => [p.date, p.bps]), [['1999-11-05', 200], ['2000-02-04', 225]]);
});

test('BCB requests stay inside the ten-year window SGS allows and cover 2000 to today', () => {
  const urls = sgsUrls('2026-10-07');
  assert.match(urls[0], /dataInicial=01\/01\/2000/);
  assert.match(urls.at(-1) ?? '', /dataFinal=07\/10\/2026/);
  for (const u of urls) {
    const [from, to] = [u.match(/dataInicial=(\d{2})\/(\d{2})\/(\d{4})/), u.match(/dataFinal=(\d{2})\/(\d{2})\/(\d{4})/)];
    assert.ok(from && to);
    assert.ok(Number(to[3]) - Number(from[3]) < 10, u);
  }
});

for (const c of CASES) {
  test(`${c.code} adapter builds a valid series-only release ending at the official level`, async () => {
    const { release, statuses } = await SERIES_ADAPTERS[c.code]({ now: '2026-10-07T12:00:00Z', fetchImpl: stubFetch(c.routes) });
    assert.deepEqual(validateRelease(release, undefined, COUNTRIES[c.code].allowlist), []);
    assert.equal(release.country.code, c.code);
    assert.deepEqual(release.decisions, []);
    assert.deepEqual(statuses, []);
    const last = release.series.at(-1);
    assert.equal(last?.date, c.latestDate);
    assert.deepEqual(last?.level, { kind: 'point', bps: c.latest });
    assert.ok(release.series.every((p, i) => i === 0 || JSON.stringify(p.level) !== JSON.stringify(release.series[i - 1].level)), 'only change points');
    assert.ok(release.series.every(p => p.evidence === 'official'));
    if (c.through) assert.equal(release.release.observedThrough, c.through);
    assert.equal(release.eras.length, 1);
    assert.equal(release.eras[0].basis, 'policy');
    assert.ok(release.transmission.length >= 2);
  });
}

for (const code of ['EA', 'GB', 'CA', 'AU', 'BR'] as const) {
  test(`${code} transmission notes cite allowlisted official sources`, () => {
    const sources = new Map(loadSources(code).map(s => [s.id, s]));
    for (const t of loadTransmission(code)) {
      const s = sources.get(t.sourceId);
      assert.ok(s, `missing source ${t.sourceId}`);
      const host = new URL(s.url).hostname;
      assert.ok(COUNTRIES[code].allowlist.some(d => host === d || host.endsWith(`.${d}`)), host);
    }
  });
}
