#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffReleaseSnapshots } from '../src/lib/releaseDiff.js';

export { diffReleaseSnapshots };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(ROOT, 'public', 'data', 'manifest.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function snapshotPath(entry) {
  return join(ROOT, 'public', 'data', entry.file);
}


function recordLine(record) {
  return `- ${record.date} · ${record.repoRate}% · ${record.action} · ${record.id}`;
}

export function buildReleaseReport({ fromRelease, toRelease, fromSnapshot, toSnapshot }) {
  const diff = diffReleaseSnapshots(fromSnapshot, toSnapshot);
  const coverage = toSnapshot?.meta?.coverage || {};
  return [
    '# RBI release change report',
    '',
    `- From: ${fromRelease.releaseId} (${fromRelease.date || fromSnapshot?.meta?.snapshotId || 'unknown date'})`,
    `- To: ${toRelease.releaseId} (${toRelease.date || toSnapshot?.meta?.snapshotId || 'unknown date'})`,
    `- To artifact: ${toRelease.artifactSha256 || 'not reported'}`,
    `- To retrieval: ${toSnapshot?.meta?.retrievedAt || toRelease.retrievedAt || 'not reported'}`,
    '',
    '## Summary',
    '',
    `- Added records: ${diff.added.length}`,
    `- Removed records: ${diff.removed.length}`,
    `- Changed records: ${diff.changed.length}`,
    `- Changed sources: ${diff.sourceChanges.length}`,
    `- Coverage records: ${coverage.totalRecords ?? toSnapshot?.decisions?.length ?? 0}`,
    '',
    '## Added records',
    '',
    ...(diff.added.length ? diff.added.map(recordLine) : ['- None']),
    '',
    '## Removed records',
    '',
    ...(diff.removed.length ? diff.removed.map(recordLine) : ['- None']),
    '',
    '## Changed records',
    '',
    ...(diff.changed.length ? diff.changed.map(({ previous, current }) => `- ${current.id}: ${previous.date} ${previous.repoRate}% ${previous.action} → ${current.date} ${current.repoRate}% ${current.action}`) : ['- None']),
    '',
    '## Review note',
    '',
    'This report is generated from structured snapshot differences. Review source changes and record changes before publishing a refreshed release.',
    '',
  ].join('\n');
}

function manifestEntries() {
  const manifest = readJson(MANIFEST_PATH);
  return (manifest.snapshots || []).filter(entry => entry.releaseId && entry.file && entry.artifactSha256);
}

function entryById(entries, releaseId) {
  return entries.find(entry => entry.releaseId === releaseId) || null;
}

function main() {
  const entries = manifestEntries();
  const fromArg = process.argv.find(value => value.startsWith('--from='))?.slice(7);
  const toArg = process.argv.find(value => value.startsWith('--to='))?.slice(5);
  const outputArg = process.argv.find(value => value.startsWith('--output='))?.slice(9);
  const toRelease = entryById(entries, toArg) || entries.at(-1);
  const fromRelease = entryById(entries, fromArg) || entries.at(-2);
  if (!fromRelease || !toRelease) throw new Error('At least two content-addressed releases are required.');
  const report = buildReleaseReport({
    fromRelease,
    toRelease,
    fromSnapshot: readJson(snapshotPath(fromRelease)),
    toSnapshot: readJson(snapshotPath(toRelease)),
  });
  if (outputArg) writeFileSync(outputArg, report);
  else process.stdout.write(report);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
