import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertValidSnapshotV2,
  deriveRateChanges,
  deriveRateSeries,
  migrateSnapshot,
  validateSnapshotV2,
} from '../../src/data/snapshotV2.js';

const TEST_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const legacySnapshot = JSON.parse(readFileSync(resolve(TEST_DIR, '../../public/data/snapshots/2026-08-12.json'), 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('migrates the legacy snapshot without losing historical rate values', () => {
  const migrated = migrateSnapshot(legacySnapshot);

  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.decisions.length, legacySnapshot.rates.length);
  assert.deepEqual(
    migrated.rateSeries.map(point => [point.date, point.rate]),
    legacySnapshot.rates.map(point => [point.date, point.rate]),
  );
  assert.equal(migrated.decisions.at(-1).repoRate, legacySnapshot.rates.at(-1).rate);
  assert.equal(migrated.meta.latestOfficialDate, legacySnapshot.rates.at(-1).date);
  assert.equal(validateSnapshotV2(migrated).valid, true);
});

test('represents a hold as a canonical decision while deriving no rate change', () => {
  const legacyWithHold = {
    ...legacySnapshot,
    rates: [
      { date: '2024-04-05', rate: 6.75, source: 'RBI MPC resolution' },
      { date: '2024-06-07', rate: 6.5, source: 'RBI MPC resolution' },
      { date: '2024-08-08', rate: 6.5, source: 'RBI MPC resolution' },
    ],
  };
  const migrated = migrateSnapshot(legacyWithHold);

  assert.equal(migrated.decisions[1].action, 'cut');
  assert.equal(migrated.decisions[2].action, 'hold');
  assert.equal(migrated.decisions[2].changeBps, 0);
  assert.equal(migrated.rateSeries[2].decisionId, migrated.decisions[2].id);
  assert.deepEqual(deriveRateChanges(migrated.decisions).map(point => point.date), ['2024-06-07']);
});

test('derives the step series from decisions rather than a second source of truth', () => {
  const migrated = migrateSnapshot(legacySnapshot);
  const series = deriveRateSeries(migrated.decisions);

  assert.deepEqual(series, migrated.rateSeries);
  assert.equal(series.every(point => point.decisionId), true);
});

test('rejects duplicate decision IDs', () => {
  const invalid = clone(migrateSnapshot(legacySnapshot));
  invalid.decisions[1].id = invalid.decisions[0].id;

  assert.throws(() => assertValidSnapshotV2(invalid), /duplicate decision id/);
});

test('rejects invalid dates', () => {
  const invalid = clone(migrateSnapshot(legacySnapshot));
  invalid.decisions[1].date = '2025-02-30';

  assert.throws(() => assertValidSnapshotV2(invalid), /valid YYYY-MM-DD date/);
});

test('rejects missing rates', () => {
  const invalid = clone(migrateSnapshot(legacySnapshot));
  delete invalid.decisions[1].repoRate;

  assert.throws(() => assertValidSnapshotV2(invalid), /decisions\[1\]\.repoRate is required/);
});

test('rejects unsorted decisions', () => {
  const invalid = clone(migrateSnapshot(legacySnapshot));
  [invalid.decisions[1], invalid.decisions[2]] = [invalid.decisions[2], invalid.decisions[1]];

  assert.throws(() => assertValidSnapshotV2(invalid), /strictly sorted by date/);
});

test('requires macro-event citations to use trusted official domains', () => {
  const invalid = clone(migrateSnapshot(legacySnapshot));
  invalid.events[0].citation = 'https://example.com/macro-event';

  assert.throws(() => assertValidSnapshotV2(invalid), /official RBI, RBI Docs, MHA, or CBIC domain/);
});
