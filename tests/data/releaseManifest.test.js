import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bundledRelease } from '../../data/legacy/in/releaseMeta.js';

const root = resolve(new URL('../..', import.meta.url).pathname);
const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

test('public and bundled artifacts identify the same release bytes', () => {
  const snapshotBytes = readFileSync(resolve(root, 'data/legacy/in/snapshot.json'));
  const archiveBytes = readFileSync(resolve(root, `public/data/${bundledRelease.artifactPath}`));
  const manifest = readJson('public/data/manifest.json');
  const snapshot = JSON.parse(snapshotBytes);
  const entry = manifest.snapshots.find(item => item.releaseId === bundledRelease.releaseId);

  assert.ok(entry, 'bundled release must be registered in the public manifest');
  assert.deepEqual(archiveBytes, snapshotBytes);
  assert.equal(digest(snapshotBytes), bundledRelease.artifactSha256);
  assert.equal(entry.artifactSha256, bundledRelease.artifactSha256);
  assert.equal(entry.checksum, snapshot.meta.checksum);
  assert.equal(entry.retrievedAt, snapshot.meta.retrievedAt);
  assert.deepEqual(entry.coverage, bundledRelease.coverage);
  const coverage = bundledRelease.coverage;
  assert.equal(coverage.totalRecords, snapshot.decisions.length);
  assert.equal(coverage.mixedRecords, 0);
  assert.equal(
    coverage.directDecisionRecords + coverage.officialContextRecords + coverage.historicalObservationRecords,
    coverage.totalRecords,
    'every record must carry exactly one evidence class',
  );
});

test('every Hugging Face dataset is built from the releases in the data manifest', () => {
  const manifest = readJson('data/manifest.json');
  for (const dir of ['central-bank-policy-rates', 'india-repo-rate-dataset']) {
    const hf = readJson(`hf/${dir}/provenance/build-manifest.json`);
    for (const r of hf.releases) assert.equal(r.hash, manifest.countries[r.country_code].release, `${dir} ${r.country_code}`);
  }
});
