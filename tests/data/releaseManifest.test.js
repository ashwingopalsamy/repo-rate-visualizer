import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bundledRelease } from '../../src/data/releaseMeta.js';

const root = resolve(new URL('../..', import.meta.url).pathname);
const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

test('public, bundled, and Hugging Face artifacts identify the same release bytes', () => {
  const snapshotBytes = readFileSync(resolve(root, 'src/data/snapshot.json'));
  const archiveBytes = readFileSync(resolve(root, `public/data/${bundledRelease.artifactPath}`));
  const manifest = readJson('public/data/manifest.json');
  const hfManifest = readJson('hf-dataset/provenance/build-manifest.json');
  const snapshot = JSON.parse(snapshotBytes);
  const entry = manifest.snapshots.find(item => item.releaseId === bundledRelease.releaseId);

  assert.ok(entry, 'bundled release must be registered in the public manifest');
  assert.deepEqual(archiveBytes, snapshotBytes);
  assert.equal(digest(snapshotBytes), bundledRelease.artifactSha256);
  assert.equal(entry.artifactSha256, bundledRelease.artifactSha256);
  assert.equal(entry.checksum, snapshot.meta.checksum);
  assert.equal(entry.retrievedAt, snapshot.meta.retrievedAt);
  assert.deepEqual(entry.coverage, bundledRelease.coverage);
  assert.deepEqual(bundledRelease.coverage, {
    totalRecords: snapshot.decisions.length,
    directDecisionRecords: 3,
    officialContextRecords: 0,
    historicalObservationRecords: 104,
    mixedRecords: 0,
  });
  assert.equal(hfManifest.source_snapshot_checksum, snapshot.meta.checksum);
  assert.equal(hfManifest.source_release_id, bundledRelease.releaseId);
  assert.equal(hfManifest.source_artifact_sha256, bundledRelease.artifactSha256);
  assert.equal(hfManifest.record_counts_by_config.decisions, snapshot.decisions.length);
});
