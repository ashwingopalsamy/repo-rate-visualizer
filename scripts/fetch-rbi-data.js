#!/usr/bin/env node

/**
 * Fetch RBI Repo Rate data and generate a versioned snapshot.
 *
 * Usage: node scripts/fetch-rbi-data.js
 *
 * This script:
 * 1. Reads the current snapshot as the baseline
 * 2. Fetches the latest data from RBI (placeholder - requires manual entry for now)
 * 3. Generates a new immutable snapshot with metadata
 * 4. Updates the manifest
 * 5. Copies the snapshot to src/data/snapshot.json for build-time bundling
 *
 * In production, step 2 would scrape the RBI monetary policy page.
 * RBI does not provide a structured API, so manual verification is recommended.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SNAPSHOTS_DIR = join(ROOT, 'public', 'data', 'snapshots');
const MANIFEST_PATH = join(ROOT, 'public', 'data', 'manifest.json');
const BUILD_SNAPSHOT = join(ROOT, 'src', 'data', 'snapshot.json');

function today() {
  return new Date().toISOString().split('T')[0];
}

function computeChecksum(data) {
  return 'sha256:' + createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 12);
}

function run() {
  // Read current snapshot as baseline
  const currentSnapshot = JSON.parse(readFileSync(BUILD_SNAPSHOT, 'utf-8'));

  console.log(`Current snapshot: ${currentSnapshot.snapshot_id}`);
  console.log(`Current rates: ${currentSnapshot.rates.length} entries`);
  console.log(`Latest rate: ${currentSnapshot.rates.at(-1).rate}% on ${currentSnapshot.rates.at(-1).date}`);

  // NOTE: In a production setup, this would fetch from:
  // https://www.rbi.org.in/Scripts/Annualpolicy.aspx
  // and parse the HTML table for new rate decisions.
  //
  // For now, manual updates: edit the snapshot JSON directly and re-run.

  const dateStr = today();
  const snapshotId = `${dateStr}-v1`;

  const newSnapshot = {
    ...currentSnapshot,
    snapshot_id: snapshotId,
    fetched_at: new Date().toISOString(),
    checksum: computeChecksum(currentSnapshot.rates),
  };

  // Write immutable snapshot
  mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const snapshotPath = join(SNAPSHOTS_DIR, `${dateStr}.json`);
  writeFileSync(snapshotPath, JSON.stringify(newSnapshot, null, 2));
  console.log(`Written snapshot: ${snapshotPath}`);

  // Update build-time copy
  writeFileSync(BUILD_SNAPSHOT, JSON.stringify(newSnapshot, null, 2));
  console.log(`Updated build snapshot: ${BUILD_SNAPSHOT}`);

  // Update manifest
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const exists = manifest.snapshots.some(s => s.date === dateStr);
  if (!exists) {
    manifest.snapshots.push({
      id: snapshotId,
      date: dateStr,
      file: `snapshots/${dateStr}.json`,
      checksum: newSnapshot.checksum,
    });
  }
  manifest.latest = dateStr;
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Updated manifest, latest: ${dateStr}`);
}

run();
