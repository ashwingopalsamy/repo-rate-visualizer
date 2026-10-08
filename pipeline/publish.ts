/**
 * Merge candidate releases from .out/ into data/. Usage: node pipeline/publish.ts [--check]
 * Writes a release only when its hash differs from the manifest; never rewrites an existing release file.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CountryRelease } from '../schema/release.ts';
import { HealthFileSchema, ManifestSchema, ScheduleFileSchema } from '../schema/files.ts';
import type { HealthFile, Manifest } from '../schema/files.ts';
import { releaseHash } from '../schema/hash.ts';
import { validateRelease } from '../schema/invariants.ts';
import { COUNTRIES } from './countries/registry.ts';
import type { CountryCode } from './countries/registry.ts';
import { buildSchedule } from './schedule.ts';
import type { CountryStatus } from './run.ts';

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const writeJson = (path: string, value: unknown) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); };
const allowlistFor = (code: string) => COUNTRIES[code as CountryCode]?.allowlist;
const latestRecordDate = (r: CountryRelease) => [...r.decisions.map(d => d.announcedAt.slice(0, 10)), ...r.series.map(p => p.date)].sort().at(-1) ?? r.coverage.seriesFrom;
const HEALTH_REFRESH_MS = 7 * 86_400_000;
const V2_PATHS = ['public/data', 'data/legacy'];

export function publish({ outDir, dataDir, now }: { outDir: string; dataDir: string; now: string }): { changed: string[]; errors: string[] } {
  const manifestPath = join(dataDir, 'manifest.json');
  const manifest: Manifest = existsSync(manifestPath) ? readJson(manifestPath) : { schemaVersion: 1, countries: {} };
  const healthPath = join(dataDir, 'health.json');
  const health: HealthFile = existsSync(healthPath) ? readJson(healthPath) : {};
  const changed: string[] = [];
  const errors: string[] = [];
  let healthChanged = false;
  const codes = existsSync(outDir) ? readdirSync(outDir).filter(c => existsSync(join(outDir, c, 'status.json'))).sort() : [];

  for (const code of codes) {
    const status = readJson<CountryStatus>(join(outDir, code, 'status.json'));
    const state = !status.ok ? 'failed' : status.statuses.some(s => s.state === 'pending') ? 'pending' : 'ok';
    const prev = health[code];
    if (!prev || prev.status !== state || Date.parse(now) - Date.parse(prev.checkedAt) >= HEALTH_REFRESH_MS) {
      health[code] = { checkedAt: now, status: state, ...(status.error ? { detail: status.error } : {}) };
      healthChanged = true;
    }
    if (!status.ok) continue;
    const candidatePath = join(outDir, code, 'candidate.json');
    if (!existsSync(candidatePath)) { errors.push(`${code}: status ok but no candidate`); continue; }
    const candidate = readJson<CountryRelease>(candidatePath);
    const hash = releaseHash(candidate);
    if (candidate.release.hash !== hash) { errors.push(`${code}: candidate hash mismatch`); continue; }
    const entry = manifest.countries[code];
    if (entry?.release === hash) continue;
    const previous = entry ? readJson<CountryRelease>(join(dataDir, entry.path)) : undefined;
    const issues = validateRelease(candidate, previous, allowlistFor(code));
    if (issues.length) { errors.push(`${code}: ${issues.map(i => `${i.code} ${i.message}`).join('; ')}`); continue; }
    const path = `releases/${code}/${hash}.json`;
    if (!existsSync(join(dataDir, path))) writeJson(join(dataDir, path), candidate);
    manifest.countries[code] = { status: 'available', release: hash, path, latestRecordDate: latestRecordDate(candidate), lastChangedAt: now };
    changed.push(code);
    const v2 = join(outDir, code, 'v2');
    // Only India's v2 data paths may be written from a candidate; anything else in the artifact is ignored.
    if (code === 'IN') for (const path of V2_PATHS) if (existsSync(join(v2, path))) cpSync(join(v2, path), join(dirname(dataDir), path), { recursive: true });
  }

  if (changed.length) writeJson(manifestPath, manifest);
  if (healthChanged) writeJson(healthPath, health);
  if (changed.length || !existsSync(join(dataDir, 'schedule.json'))) {
    const current = Object.fromEntries(Object.entries(manifest.countries).map(([code, e]) => [code, readJson<CountryRelease>(join(dataDir, e.path))]));
    if (Object.keys(current).length) {
      const lastChangedAt = Object.values(manifest.countries).map(e => e.lastChangedAt).sort().at(-1) ?? now;
      writeJson(join(dataDir, 'schedule.json'), buildSchedule(current, now, lastChangedAt));
    }
  }
  return { changed, errors };
}

/** Validate every committed release, its hash, and the side files. Returns human-readable problems; empty means valid. */
export function checkData(dataDir: string, readBase?: (path: string) => string | undefined): string[] {
  const problems: string[] = [];
  const manifestPath = join(dataDir, 'manifest.json');
  if (!existsSync(manifestPath)) return ['data/manifest.json is missing'];
  const parsed = ManifestSchema.safeParse(readJson(manifestPath));
  if (!parsed.success) return [`manifest: ${parsed.error.message}`];
  for (const [code, entry] of Object.entries(parsed.data.countries)) {
    const path = join(dataDir, entry.path);
    if (!existsSync(path)) { problems.push(`${code}: release file ${entry.path} is missing`); continue; }
    const release = readJson<CountryRelease>(path);
    if (releaseHash(release) !== entry.release) problems.push(`${code}: release hash does not match manifest`);
    // Append-only against the base branch: a PR may add releases but never rewrite what was published.
    const baseManifest = readBase?.('manifest.json');
    const baseEntry = baseManifest ? (JSON.parse(baseManifest) as Manifest).countries[code] : undefined;
    const baseText = baseEntry && baseEntry.release !== entry.release ? readBase?.(baseEntry.path) : undefined;
    const previous = baseText ? (JSON.parse(baseText) as CountryRelease) : undefined;
    validateRelease(release, previous, allowlistFor(code)).forEach(i => problems.push(`${code}: ${i.code} ${i.message}`));
  }
  const schedulePath = join(dataDir, 'schedule.json');
  if (existsSync(schedulePath) && !ScheduleFileSchema.safeParse(readJson(schedulePath)).success) problems.push('schedule.json does not match its schema');
  const healthPath = join(dataDir, 'health.json');
  if (existsSync(healthPath) && !HealthFileSchema.safeParse(readJson(healthPath)).success) problems.push('health.json does not match its schema');
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  if (process.argv.includes('--check')) {
    const baseIndex = process.argv.indexOf('--base');
    const baseRef = baseIndex >= 0 ? process.argv[baseIndex + 1] : undefined;
    const readBase = baseRef ? (path: string) => { try { return execFileSync('git', ['show', `${baseRef}:data/${path}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return undefined; } } : undefined;
    const problems = checkData(join(root, 'data'), readBase);
    problems.forEach(p => console.error(p));
    console.log(problems.length ? `${problems.length} problem(s)` : 'data/ is valid');
    process.exitCode = problems.length ? 1 : 0;
  } else {
    const { changed, errors } = publish({ outDir: join(root, '.out'), dataDir: join(root, 'data'), now: new Date().toISOString() });
    console.log(changed.length ? `published: ${changed.join(', ')}` : 'no release changed');
    errors.forEach(e => console.error(e));
    process.exitCode = errors.length ? 1 : 0;
  }
}
