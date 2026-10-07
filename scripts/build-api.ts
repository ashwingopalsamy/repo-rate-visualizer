/**
 * Writes the static JSON and CSV API from the published releases, plus the v1 redirects.
 * Usage: node scripts/build-api.ts [--out public/api/v1] [--redirects public/_redirects]
 *
 *   countries.json                 every country with its current level and release
 *   latest.json                    the level in force per country
 *   schedule.json                  announced decision times
 *   countries/{cc}.json            the current release
 *   countries/{cc}/decisions.csv   one row per decision
 *   countries/{cc}/series.csv      one row per change point
 *   releases/{CC}/{hash}.json      immutable, content-addressed releases
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CountryRelease } from '../schema/release.ts';
import type { Level } from '../schema/level.ts';
import type { Manifest, ScheduleFile } from '../schema/files.ts';

const ROOT = new URL('../', import.meta.url);
const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, ROOT), 'utf8')) as T;
const lohi = (l: Level): [number | null, number | null] => (l.kind === 'range' ? [l.lowBps, l.highBps] : l.kind === 'point' ? [l.bps, l.bps] : [null, null]);

/** A CSV cell. Text starting with = + - @ (or a tab or carriage return) is prefixed with ' so spreadsheets never run it. */
export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v == null) return '';
  if (typeof v !== 'string') return String(v);
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csv = (head: string[], rows: (string | number | boolean | null | undefined)[][]) => [head.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n') + '\n';

export function decisionsCsv(r: CountryRelease): string {
  return csv(['announced_at', 'effective_date', 'direction', 'change_bps', 'low_bps', 'high_bps', 'vote_for', 'vote_against', 'stance', 'statement_url', 'off_cycle'],
    r.decisions.map(d => [d.announcedAt, d.effectiveDate, d.direction, d.changeBps, ...lohi(d.level), d.vote?.for, d.vote?.against, d.stance, d.statementUrl, d.offCycle]));
}
export function seriesCsv(r: CountryRelease): string {
  return csv(['date', 'low_bps', 'high_bps', 'evidence'], r.series.map(p => [p.date, ...lohi(p.level), p.evidence]));
}

/** v1 links: decisions had their own page; the country and limitations pages folded into the new site. */
export function redirects(): string {
  return ['/decision/* /in/ 302', '/countries / 301', '/country/in /in/ 301', '/country/us /us/ 301', '/limitations / 302', ''].join('\n');
}

export function buildApi(out: string): { files: number } {
  const manifest = read<Manifest>('data/manifest.json'), schedule = read<ScheduleFile>('data/schedule.json');
  rmSync(out, { recursive: true, force: true });
  let files = 0;
  const put = (path: string, body: string) => { const p = join(out, path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); files++; };
  const json = (v: unknown) => JSON.stringify(v, null, 1) + '\n';
  const list: unknown[] = [], latest: Record<string, unknown> = {};
  let generatedAt = '';
  for (const [cc, entry] of Object.entries(manifest.countries)) {
    if (entry.status !== 'available' || !entry.path || !entry.release) continue;
    const raw = readFileSync(new URL(`data/${entry.path}`, ROOT), 'utf8'), r = JSON.parse(raw) as CountryRelease, lc = cc.toLowerCase();
    const last = r.series[r.series.length - 1], dec = r.decisions[r.decisions.length - 1] ?? null;
    if (r.release.observedThrough > generatedAt) generatedAt = r.release.observedThrough;
    const base = `/api/v1/countries/${lc}`;
    list.push({
      cc, name: r.country.name, authority: r.authority.name, instrument: r.instrument.name, level: last.level, since: last.date,
      observedThrough: r.release.observedThrough, release: entry.release,
      links: { release: `${base}.json`, decisions: `${base}/decisions.csv`, series: `${base}/series.csv`, page: `/${lc}/` },
    });
    latest[cc] = {
      level: last.level, since: last.date, observedThrough: r.release.observedThrough, release: entry.release,
      lastDecision: dec && { announcedAt: dec.announcedAt, direction: dec.direction, changeBps: dec.changeBps },
    };
    put(`countries/${lc}.json`, raw);
    put(`countries/${lc}/decisions.csv`, decisionsCsv(r));
    put(`countries/${lc}/series.csv`, seriesCsv(r));
    put(`releases/${cc}/${entry.release}.json`, raw);
  }
  put('countries.json', json({ schemaVersion: 1, generatedAt, countries: list }));
  put('latest.json', json({ schemaVersion: 1, generatedAt, countries: latest }));
  put('schedule.json', json({ schemaVersion: 1, generatedAt: schedule.generatedAt, items: schedule.items.filter(i => !i.resolved) }));
  return { files };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const out = arg('--out', 'public/api/v1'), red = arg('--redirects', 'public/_redirects');
  const { files } = buildApi(out);
  writeFileSync(red, redirects());
  console.log(`api: ${files} files in ${out}; redirects in ${red}`);
}
