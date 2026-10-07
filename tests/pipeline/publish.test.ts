import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkData, publish } from '../../pipeline/publish.ts';
import { buildSchedule } from '../../pipeline/schedule.ts';
import { loadCalendar } from '../../pipeline/countries/registry.ts';
import { releaseHash } from '../../schema/hash.ts';
import { baseRelease, indiaLikeRelease } from './fixtures.ts';
import type { CountryRelease } from '../../schema/release.ts';

const NOW = '2026-10-07T12:00:00Z';
function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'atlas-publish-'));
  const outDir = join(root, '.out'); const dataDir = join(root, 'data');
  mkdirSync(outDir); mkdirSync(dataDir);
  return { root, outDir, dataDir };
}
function stage(outDir: string, code: string, release: CountryRelease | null, ok = true) {
  const dir = join(outDir, code); mkdirSync(dir, { recursive: true });
  if (release) { release.release.hash = releaseHash(release); writeFileSync(join(dir, 'candidate.json'), JSON.stringify(release)); }
  writeFileSync(join(dir, 'status.json'), JSON.stringify({ code, ok, statuses: ok ? [] : [], error: ok ? undefined : 'boom' }));
}
const manifest = (dataDir: string) => JSON.parse(readFileSync(join(dataDir, 'manifest.json'), 'utf8'));

test('a new candidate writes an immutable release and updates the manifest', () => {
  const { outDir, dataDir } = workspace();
  const r = baseRelease();
  stage(outDir, 'US', r);
  const result = publish({ outDir, dataDir, now: NOW });
  assert.deepEqual(result.changed, ['US']);
  const entry = manifest(dataDir).countries.US;
  assert.equal(entry.release, releaseHash(r));
  assert.equal(entry.path, `releases/US/${releaseHash(r)}.json`);
  assert.equal(entry.latestRecordDate, '2026-09-17');
  assert.ok(readdirSync(join(dataDir, 'releases', 'US')).includes(`${releaseHash(r)}.json`));
});

test('publish is a no-op when the candidate hash equals the manifest', () => {
  const { outDir, dataDir } = workspace();
  stage(outDir, 'US', baseRelease());
  publish({ outDir, dataDir, now: NOW });
  const before = readFileSync(join(dataDir, 'manifest.json'), 'utf8');
  const again = publish({ outDir, dataDir, now: '2026-10-08T12:00:00Z' });
  assert.deepEqual(again.changed, []);
  assert.equal(readFileSync(join(dataDir, 'manifest.json'), 'utf8'), before);
});

test('publish merges only the legs that succeeded', () => {
  const { outDir, dataDir } = workspace();
  stage(outDir, 'US', null, false);
  stage(outDir, 'IN', indiaLikeRelease());
  const result = publish({ outDir, dataDir, now: NOW });
  assert.deepEqual(result.changed, ['IN']);
  assert.equal(manifest(dataDir).countries.US, undefined);
  assert.ok(manifest(dataDir).countries.IN);
});

test('an invalid candidate leaves data untouched and reports an error', () => {
  const { outDir, dataDir } = workspace();
  const broken = baseRelease();
  broken.series.push({ ...broken.series[0] });
  stage(outDir, 'US', broken);
  const result = publish({ outDir, dataDir, now: NOW });
  assert.deepEqual(result.changed, []);
  assert.ok(result.errors.some(e => e.includes('series-order')));
  assert.deepEqual(readdirSync(dataDir).filter(f => f === 'releases'), []);
});

test('buildSchedule marks decided meetings resolved and upcoming ones not', () => {
  const decisions = [{ meetingId: 'IN-2026-10-07' }];
  const schedule = buildSchedule({ IN: { calendar: loadCalendar('IN'), decisions } }, NOW, '2026-10-07T04:40:00Z');
  assert.equal(schedule.items.find(i => i.meetingId === 'IN-2026-10-07')?.resolved, true);
  const december = schedule.items.find(i => i.meetingId === 'IN-2026-12-04');
  assert.equal(december?.resolved, false);
  assert.equal(december?.announceAt, '2026-12-04T10:00:00+05:30');
  assert.equal(schedule.items.find(i => i.meetingId === 'IN-2016-10-04')?.resolved, false);
  const later = buildSchedule({ IN: { calendar: loadCalendar('IN'), decisions } }, '2027-01-01T00:00:00Z', '2026-10-07T04:40:00Z');
  assert.equal(later.generatedAt, schedule.generatedAt, 'generatedAt must not depend on the clock');
});

test('checkData accepts a published tree and rejects a tampered release', () => {
  const { outDir, dataDir } = workspace();
  stage(outDir, 'US', baseRelease());
  publish({ outDir, dataDir, now: NOW });
  assert.deepEqual(checkData(dataDir), []);
  const entry = manifest(dataDir).countries.US;
  const path = join(dataDir, entry.path);
  const tampered = JSON.parse(readFileSync(path, 'utf8')); tampered.decisions[0].excerpt = 'tampered';
  writeFileSync(path, JSON.stringify(tampered));
  assert.ok(checkData(dataDir).some(e => e.includes('hash')));
});

test('only allowlisted India v2 paths are copied into the repository', () => {
  const { root, outDir, dataDir } = workspace();
  stage(outDir, 'IN', indiaLikeRelease());
  mkdirSync(join(outDir, 'IN', 'v2', 'public', 'data'), { recursive: true });
  writeFileSync(join(outDir, 'IN', 'v2', 'public', 'data', 'manifest.json'), '{}');
  writeFileSync(join(outDir, 'IN', 'v2', 'package.json'), '{"scripts":{"build":"curl evil"}}');
  publish({ outDir, dataDir, now: NOW });
  assert.ok(existsSync(join(root, 'public', 'data', 'manifest.json')));
  assert.equal(existsSync(join(root, 'package.json')), false);
});

test('checkData rejects a release that rewrites the base branch history', () => {
  const { outDir, dataDir } = workspace();
  stage(outDir, 'US', baseRelease());
  publish({ outDir, dataDir, now: NOW });
  const baseManifest = readFileSync(join(dataDir, 'manifest.json'), 'utf8');
  const baseEntry = JSON.parse(baseManifest).countries.US;
  const baseRelease0 = readFileSync(join(dataDir, baseEntry.path), 'utf8');
  const readBase = (path: string) => (path === 'manifest.json' ? baseManifest : path === baseEntry.path ? baseRelease0 : undefined);
  const rewritten = baseRelease();
  rewritten.decisions[0].excerpt = 'Quietly edited.';
  const out2 = join(outDir, '..', '.out2'); mkdirSync(out2);
  stage(out2, 'US', rewritten);
  const manifestPath = join(dataDir, 'manifest.json');
  const m = JSON.parse(baseManifest); delete m.countries.US; writeFileSync(manifestPath, JSON.stringify(m));
  publish({ outDir: out2, dataDir, now: NOW });
  assert.ok(checkData(dataDir, readBase).some(e => e.includes('history-rewrite')));
  assert.deepEqual(checkData(dataDir), []);
});
