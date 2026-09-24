import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReleaseReport, diffReleaseSnapshots } from '../../scripts/build-release-report.js';
import { buildReleaseDiffCsv, buildReleaseDiffText } from '../../src/lib/releaseDiff.js';

const base = {
  meta: { snapshotId: 'old', retrievedAt: '2026-01-01T00:00:00.000Z', coverage: { totalRecords: 1 } },
  decisions: [{ id: 'one', date: '2026-01-01', repoRate: 6, action: 'hold', changeBps: 0, sourceIds: ['source-a'] }],
  sources: [{ id: 'source-a', url: 'https://example.com/a', checksum: 'a', title: 'A' }],
};
const next = {
  meta: { snapshotId: 'new', retrievedAt: '2026-02-01T00:00:00.000Z', coverage: { totalRecords: 2 } },
  decisions: [
    { id: 'one', date: '2026-01-01', repoRate: 5.75, action: 'cut', changeBps: -25, sourceIds: ['source-a'] },
    { id: 'two', date: '2026-02-01', repoRate: 5.75, action: 'hold', changeBps: 0, sourceIds: ['source-b'] },
  ],
  sources: [{ id: 'source-a', url: 'https://example.com/a', checksum: 'changed', title: 'A' }, { id: 'source-b', url: 'https://example.com/b', checksum: 'b', title: 'B' }],
};

test('release report classifies record and source changes', () => {
  const diff = diffReleaseSnapshots(base, next);
  assert.equal(diff.added.length, 1);
  assert.equal(diff.removed.length, 0);
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.sourceChanges.length, 1);
  const report = buildReleaseReport({ fromRelease: { releaseId: 'old', date: '2026-01-01' }, toRelease: { releaseId: 'new', date: '2026-02-01', artifactSha256: 'sha' }, fromSnapshot: base, toSnapshot: next });
  assert.match(report, /Added records: 1/);
  assert.match(report, /Changed sources: 1/);
  const csv = buildReleaseDiffCsv({ diff, fromRelease: { releaseId: 'old' }, toRelease: { releaseId: 'new' } });
  assert.match(csv, /"Category"/);
  assert.match(csv, /"added","two"/);
  assert.match(buildReleaseDiffText({ diff, fromRelease: { releaseId: 'old' }, toRelease: { releaseId: 'new' } }), /old → new/);
});
