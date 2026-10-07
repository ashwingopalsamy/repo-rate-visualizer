import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCountries } from '../../pipeline/run.ts';
import { SourceParseError } from '../../pipeline/lib/errors.ts';
import { baseRelease, indiaLikeRelease } from './fixtures.ts';
import { releaseHash } from '../../schema/hash.ts';

test('run marks a failing country failed, writes no candidate for it, and still writes the others', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'atlas-run-'));
  await runCountries(['IN', 'US'], {
    now: '2026-10-07T12:00:00Z',
    outDir,
    readPrevious: () => undefined,
    adapters: {
      IN: async () => { throw new SourceParseError('RBI page changed'); },
      US: async () => ({ release: baseRelease(), statuses: [] }),
    },
  });
  const inStatus = JSON.parse(readFileSync(join(outDir, 'IN', 'status.json'), 'utf8'));
  assert.equal(inStatus.ok, false);
  assert.match(inStatus.error, /RBI page changed/);
  assert.equal(existsSync(join(outDir, 'IN', 'candidate.json')), false);
  const us = JSON.parse(readFileSync(join(outDir, 'US', 'candidate.json'), 'utf8'));
  assert.match(us.release.hash, /^[0-9a-f]{64}$/);
  assert.equal(JSON.parse(readFileSync(join(outDir, 'US', 'status.json'), 'utf8')).ok, true);
});

test('run rejects a candidate that breaks an invariant', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'atlas-run-'));
  const broken = baseRelease();
  broken.series.push({ ...broken.series[0] });
  await runCountries(['US'], { now: '2026-10-07T12:00:00Z', outDir, readPrevious: () => undefined, adapters: { US: async () => ({ release: broken, statuses: [] }) } });
  const status = JSON.parse(readFileSync(join(outDir, 'US', 'status.json'), 'utf8'));
  assert.equal(status.ok, false);
  assert.ok(status.issues.some((i: { code: string }) => i.code === 'series-order'));
  assert.equal(existsSync(join(outDir, 'US', 'candidate.json')), false);
});

test('India v2 changes are collected only when the India release changed', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'atlas-run-'));
  const committed = indiaLikeRelease();
  committed.release.hash = releaseHash(committed);
  const collected: string[] = [];
  const opts = (previous: ReturnType<typeof indiaLikeRelease> | undefined) => ({
    now: '2026-10-07T12:00:00Z', outDir, readPrevious: () => previous,
    adapters: { IN: async () => ({ release: indiaLikeRelease(), statuses: [] }) },
    collectV2: (dir: string) => { collected.push(dir); },
  });
  await runCountries(['IN'], opts(committed));
  assert.deepEqual(collected, []);
  const older = indiaLikeRelease(); older.decisions = older.decisions.slice(0, 1); older.series = older.series.slice(0, 1); older.calendar = older.calendar.slice(0, 1); older.release.observedThrough = '2026-08-01';
  older.release.hash = releaseHash(older);
  await runCountries(['IN'], opts(older));
  assert.equal(collected.length, 1);
});
