/**
 * Build candidate releases. Usage: node pipeline/run.ts --countries IN,US|ALL [--reason <text>] [--now <iso>] [--out .out]
 * Writes .out/<CC>/status.json for every country and .out/<CC>/candidate.json only for a valid release.
 * Exits 0 even when some countries fail; publish.ts merges whatever succeeded.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CountryRelease } from '../schema/release.ts';
import { releaseHash } from '../schema/hash.ts';
import { validateRelease } from '../schema/invariants.ts';
import type { Issue } from '../schema/invariants.ts';
import { COUNTRIES } from './countries/registry.ts';
import type { CountryCode } from './countries/registry.ts';
import { runIndia } from './countries/in/adapter.ts';
import { runUs } from './countries/us/adapter.ts';
import { resolveMeetings } from './resolve.ts';
import type { CountryResult, MeetingStatus, RunContext } from './types.ts';

export type Adapter = (ctx: RunContext) => Promise<CountryResult>;
export type CountryStatus = { code: string; ok: boolean; reason?: string; statuses: MeetingStatus[]; hash?: string; error?: string; issues?: Issue[] };

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DEFAULT_ADAPTERS: Record<CountryCode, Adapter> = { IN: runIndia, US: runUs };
const V2_PATHS = ['public/data', 'src/data', 'hf-dataset'];

/** The release the manifest currently points at, if any. */
export function readCommittedRelease(code: string): CountryRelease | undefined {
  const manifestPath = join(ROOT, 'data', 'manifest.json');
  if (!existsSync(manifestPath)) return undefined;
  const entry = JSON.parse(readFileSync(manifestPath, 'utf8')).countries?.[code];
  return entry ? JSON.parse(readFileSync(join(ROOT, 'data', entry.path), 'utf8')) : undefined;
}

function copyV2Changes(dir: string): void {
  const changed = execFileSync('git', ['status', '--porcelain', '--', ...V2_PATHS], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean).map(line => line.slice(3).trim());
  for (const path of changed) {
    const target = join(dir, 'v2', path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(ROOT, path), target);
  }
}

export async function runCountries(codes: string[], opts: {
  now: string; outDir: string; reason?: string; adapters?: Partial<Record<string, Adapter>>;
  readPrevious?: (code: string) => CountryRelease | undefined; fetchImpl?: typeof fetch; collectV2?: boolean;
}): Promise<CountryStatus[]> {
  const adapters: Partial<Record<string, Adapter>> = opts.adapters ?? DEFAULT_ADAPTERS;
  const readPrevious = opts.readPrevious ?? readCommittedRelease;
  const results: CountryStatus[] = [];
  for (const code of codes) {
    const dir = join(opts.outDir, code);
    mkdirSync(dir, { recursive: true });
    const write = (status: CountryStatus) => { writeFileSync(join(dir, 'status.json'), `${JSON.stringify(status, null, 2)}\n`); results.push(status); };
    const adapter = adapters[code];
    const profile = COUNTRIES[code as CountryCode];
    if (!adapter || !profile) { write({ code, ok: false, reason: opts.reason, statuses: [], error: `No adapter for ${code}` }); continue; }
    try {
      const previous = readPrevious(code);
      const { release } = await adapter({ now: opts.now, previous, fetchImpl: opts.fetchImpl });
      const { statuses, synthesized } = resolveMeetings(release.calendar, release.decisions, release.series, release.coverage.seriesThrough, profile, opts.now, release.coverage.ledgerFrom);
      if (synthesized.length) {
        const held = new Set(synthesized.map(d => d.meetingId));
        release.decisions = [...release.decisions, ...synthesized].sort((a, b) => a.announcedAt.localeCompare(b.announcedAt));
        release.calendar = release.calendar.map(m => (held.has(m.id) ? { ...m, status: 'held' } : m));
      }
      const issues = validateRelease(release, previous, profile.allowlist);
      if (issues.length) { write({ code, ok: false, reason: opts.reason, statuses, issues }); continue; }
      release.release = { ...release.release, hash: releaseHash(release) };
      writeFileSync(join(dir, 'candidate.json'), `${JSON.stringify(release, null, 2)}\n`);
      if (code === 'IN' && opts.collectV2 !== false && !opts.adapters) copyV2Changes(dir);
      write({ code, ok: true, reason: opts.reason, statuses, hash: release.release.hash });
    } catch (error) {
      write({ code, ok: false, reason: opts.reason, statuses: [], error: `${(error as Error).name}: ${(error as Error).message}` });
    }
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
  const requested = (arg('countries') ?? 'ALL').toUpperCase();
  const codes = requested === 'ALL' ? Object.keys(COUNTRIES) : requested.split(',').map(c => c.trim()).filter(Boolean);
  const results = await runCountries(codes, { now: arg('now') ?? new Date().toISOString(), outDir: join(ROOT, arg('out') ?? '.out'), reason: arg('reason') });
  for (const r of results) console.log(`${r.code}: ${r.ok ? `ok ${r.hash?.slice(0, 12)}` : `FAILED ${r.error ?? r.issues?.map(i => i.code).join(',')}`} (${r.statuses.filter(s => s.state === 'pending').length} pending)`);
}
