import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runUpdate } from '../../scripts/fetch-rbi-data.js';
import {
  parseCurrentPolicyRates,
  parseDbieKeyRates,
  parsePolicyArchive,
  parsePolicyDocument,
  SourceParseError,
} from '../../scripts/rbi-sources.js';

const FIXTURE_DIR = resolve(fileURLToPath(new URL('../fixtures/rbi/', import.meta.url)));
const readFixture = name => readFileSync(resolve(FIXTURE_DIR, name), 'utf8');

test('parses the RBI current policy repo rate', () => {
  const result = parseCurrentPolicyRates(readFixture('current-rates.html'));

  assert.equal(result.repoRate, 5.25);
  assert.equal(result.rates['Standing Deposit Facility Rate'], 5);
  assert.equal(result.source.type, 'current-policy-rates');
});

test('discovers resolution and minutes links from the RBI policy archive', () => {
  const result = parsePolicyArchive(readFixture('policy-archive.html'));

  assert.deepEqual(result.map(entry => entry.type), ['policy-minutes', 'policy-resolution']);
  assert.equal(result.at(-1).publicationDate, '2026-08-05');
  assert.match(result.at(-1).url, /prid=63287/);
});

test('parses a source-backed hold and stance from an RBI resolution', () => {
  const archiveEntry = {
    type: 'policy-resolution',
    title: 'MPC resolution',
    url: 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=63287',
    publicationDate: '2026-08-05',
  };
  const result = parsePolicyDocument(readFixture('policy-resolution.html'), archiveEntry);

  assert.equal(result.decision.date, '2026-08-05');
  assert.equal(result.decision.repoRate, 5.25);
  assert.equal(result.decision.actionHint, 'hold');
  assert.equal(result.decision.stance, 'neutral');
  assert.equal(result.source.publishedAt, '2026-08-05T00:00:00.000Z');
});

test('parses DBIE CSV exports and sorts the observations', () => {
  const result = parseDbieKeyRates(readFixture('dbie-key-rates.csv'), { contentType: 'text/csv' });

  assert.deepEqual(result.rows.map(row => row.date), ['2024-04-05', '2024-06-07', '2024-08-08', '2025-02-07']);
  assert.equal(result.rows.at(-1).repoRate, 6.25);
  assert.equal(result.source.type, 'dbie-key-rates');
});

test('fails closed when a DBIE export has no repo-rate column', () => {
  assert.throws(
    () => parseDbieKeyRates('Date,Bank Rate\n2025-01-01,6.5', { contentType: 'text/csv' }),
    SourceParseError,
  );
});

test('does not overwrite the validated build snapshot when a source fetch fails', async () => {
  const snapshotPath = resolve(FIXTURE_DIR, '../../../src/data/snapshot.json');
  const before = readFileSync(snapshotPath, 'utf8');
  const unavailableFetch = async () => ({
    ok: false,
    status: 503,
    text: async () => 'unavailable',
    headers: new Map(),
  });

  await assert.rejects(
    runUpdate({ fetchImpl: unavailableFetch, dryRun: false }),
    /HTTP 503/,
  );
  assert.equal(readFileSync(snapshotPath, 'utf8'), before);
});
