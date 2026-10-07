/**
 * Builds the compact atlas view of every published release, embedded in each page (scripts/prerender.ts) and served at
 * /atlas.json for the dev server. Usage: node scripts/build-atlas.ts [--out public/atlas.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CountryRelease } from '../schema/release.ts';
import type { Level } from '../schema/level.ts';
import type { Manifest, ScheduleFile } from '../schema/files.ts';
import type { AtlasCountry, AtlasData, Code } from '../src/lib/types.ts';

const ROOT = new URL('../', import.meta.url);
const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, ROOT), 'utf8')) as T;
const lohi = (l: Level): [number, number] => (l.kind === 'range' ? [l.lowBps, l.highBps] : l.kind === 'point' ? [l.bps, l.bps] : [Number.NaN, Number.NaN]);

export function buildAtlas(): AtlasData {
  const manifest = read<Manifest>('data/manifest.json');
  const schedule = read<ScheduleFile>('data/schedule.json');
  const countries: AtlasData['countries'] = {};
  let asOf = '';
  for (const [cc, entry] of Object.entries(manifest.countries)) {
    if (entry.status !== 'available' || !entry.path) continue;
    const r = read<CountryRelease>(`data/${entry.path}`);
    if (r.release.observedThrough > asOf) asOf = r.release.observedThrough;
    const country: AtlasCountry = {
      cc: cc as Code,
      release: r.release.hash.slice(0, 12),
      policyFrom: r.eras.find(e => e.basis === 'policy')?.from ?? r.series[0].date,
      eras: r.eras.map(e => ({ from: e.from, to: e.to, basis: e.basis, label: e.instrument, note: e.note })),
      series: r.series.map(p => [p.date, ...lohi(p.level), p.evidence === 'official' ? 1 : 0]),
      decisions: r.decisions.map(d => ({
        date: d.announcedAt.slice(0, 10), effective: d.effectiveDate, lo: lohi(d.level)[0], hi: lohi(d.level)[1], change: d.changeBps,
        dir: d.direction, vote: d.vote, stance: d.stance, excerpt: d.excerpt, url: d.statementUrl, offCycle: d.offCycle,
      })),
      next: schedule.items.filter(i => i.cc === cc && !i.resolved).map(i => i.announceAt).sort(),
      transmission: r.transmission,
      sources: r.sources.length,
    };
    countries[cc as Code] = country;
  }
  return { generatedAt: asOf, countries };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out'), out = i > 0 ? process.argv[i + 1] : 'public/atlas.json';
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(buildAtlas()));
  console.log(`atlas written to ${out}`);
}
