import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCountries } from '../../pipeline/run.ts';
import { SourceParseError } from '../../pipeline/lib/errors.ts';
import { baseRelease } from './fixtures.ts';

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
