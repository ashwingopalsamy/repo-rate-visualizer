import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCitationBundle, citationFilename } from '../../src/data/citationBundle.js';

const sources = [
  { id: 'rbi', type: 'policy-resolution', title: 'RBI resolution', url: 'https://rbi.org.in/resolution', publishedAt: '2026-08-05T00:00:00.000Z', retrievedAt: '2026-08-14T00:00:00.000Z', checksum: 'sha256:rbi' },
  { id: 'reuters', type: 'historical-rate-series', title: 'Reuters historical series', url: 'https://example.com/reuters', publishedAt: null, retrievedAt: '2026-08-14T00:00:00.000Z', checksum: 'sha256:reuters' },
];
const decisions = [
  { id: 'direct-2026-08-05', date: '2026-08-05', dateObj: new Date('2026-08-05T00:00:00.000Z'), repoRate: 5.25, action: 'hold', changeBps: 0, stance: 'neutral', sourceIds: ['rbi'] },
  { id: 'history-2025-12-05', date: '2025-12-05', dateObj: new Date('2025-12-05T00:00:00.000Z'), repoRate: 5.5, action: 'cut', changeBps: -25, stance: null, sourceIds: ['reuters'] },
];

test('citation bundle preserves release identity and evidence limitation', () => {
  const bundle = buildCitationBundle({
    decisions,
    sources,
    macroEvents: [],
    regimes: [],
    dateRange: {},
    release: { releaseId: 'snapshot-test', artifactSha256: 'artifact-test', checksum: 'sha256:content-test', retrievedAt: '2026-08-14T00:00:00.000Z', schemaVersion: 2, sources },
    selectedDecisionId: 'history-2025-12-05',
  });

  assert.equal(bundle.release.releaseId, 'snapshot-test');
  assert.equal(bundle.release.checksum, 'sha256:content-test');
  assert.equal(bundle.coverage.directDecisionRecords, 1);
  assert.equal(bundle.records[1].evidenceStatus, 'historical-secondary');
  assert.match(bundle.citationText, /not a direct RBI decision-resolution citation/);
  assert.match(bundle.citationText, /artifact SHA-256 artifact-test/);
});

test('citation filenames are deterministic and release-scoped', () => {
  assert.equal(
    citationFilename({ format: 'csv', view: 'timeline', dateRange: { start: '2020-01-01', end: '2025-12-31' }, releaseId: 'snapshot-test' }),
    'rbi-repo-rate--snapshot-test--timeline--2020-01-01_2025-12-31.csv',
  );
});
