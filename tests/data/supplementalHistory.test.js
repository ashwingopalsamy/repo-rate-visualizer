import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mergeSupplementalHistory,
  REUTERS_HISTORY,
  REUTERS_HISTORY_SOURCE,
  SHRIRAM_HISTORY_SOURCE,
} from '../../src/data/supplementalHistory.js';

const TEST_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const snapshot = JSON.parse(readFileSync(resolve(TEST_DIR, '../../src/data/snapshot.json'), 'utf8'));

test('imports every supplied Reuters observation into the canonical decision ledger', () => {
  const imported = snapshot.decisions
    .filter(decision => decision.sourceIds.includes(REUTERS_HISTORY_SOURCE.id))
    .map(decision => [decision.date, decision.repoRate]);

  assert.deepEqual(imported, REUTERS_HISTORY.map(row => [row.date, row.repoRate]));
  assert.equal(imported.length, 104);
  assert.equal(snapshot.decisions.filter(decision => decision.action === 'hold' && decision.date <= '2025-12-05').length, 14);
  assert.equal(snapshot.decisions.some(decision => decision.sourceIds.includes('legacy-snapshot')), false);
});

test('keeps the supplied historical source records attached to the snapshot', () => {
  const sourceIds = new Set(snapshot.sources.map(source => source.id));
  assert.equal(sourceIds.has(REUTERS_HISTORY_SOURCE.id), true);
  assert.equal(sourceIds.has(SHRIRAM_HISTORY_SOURCE.id), true);
  assert.match(REUTERS_HISTORY_SOURCE.checksum, /^sha256:[a-f0-9]{64}$/);
  assert.match(SHRIRAM_HISTORY_SOURCE.checksum, /^sha256:[a-f0-9]{64}$/);
});

test('merging the supplemental series is idempotent', () => {
  const candidate = {
    ...snapshot,
    sources: [
      ...snapshot.sources,
      {
        id: 'source-newly-discovered-minutes',
        type: 'policy-minutes',
        title: 'Newly discovered RBI minutes',
        url: 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=63403',
        publishedAt: '2026-08-19T00:00:00.000Z',
        retrievedAt: '2026-09-23T11:00:59.915Z',
        checksum: `sha256:${'d'.repeat(64)}`,
      },
    ],
  };
  const merged = mergeSupplementalHistory(candidate);
  assert.deepEqual(merged.decisions, candidate.decisions);
  assert.deepEqual(merged.sources, candidate.sources);
  assert.deepEqual(merged.rateSeries, candidate.rateSeries);
});
