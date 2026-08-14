#!/usr/bin/env node

/**
 * Fetch verified RBI source material and generate an immutable SnapshotV2.
 *
 * The DBIE portal exposes historical Key Rates through a browser-selected
 * export rather than a stable anonymous download URL. Set
 * RBI_DBIE_KEY_RATES_URL to that official CSV/JSON export when available. In
 * its absence the last validated historical series is retained, while the
 * current-rates and policy-resolution adapters still refresh the decision
 * ledger. The script never writes until every required fetch and parse has
 * succeeded.
 *
 * Usage:
 *   node scripts/fetch-rbi-data.js
 *   node scripts/fetch-rbi-data.js --dry-run
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertValidSnapshotV2,
  deriveRateSeries,
  migrateSnapshot,
} from '../src/data/snapshotV2.js';
import {
  RBI_SOURCE_URLS,
  SourceParseError,
  fetchText,
  parseCurrentPolicyRates,
  parseDbieKeyRates,
  parsePolicyArchive,
  parsePolicyDocument,
  sha256,
} from './rbi-sources.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SNAPSHOTS_DIR = join(ROOT, 'public', 'data', 'snapshots');
const MANIFEST_PATH = join(ROOT, 'public', 'data', 'manifest.json');
const BUILD_SNAPSHOT = join(ROOT, 'src', 'data', 'snapshot.json');
const DRY_RUN = process.argv.includes('--dry-run');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function todayFrom(timestamp) {
  return timestamp.slice(0, 10);
}

function sourceIdFor(source) {
  return `source-${sha256(`${source.type}|${source.url}`).slice(7, 19)}`;
}

function enrichSource(source, fetched, fallbackTitle = source.title) {
  return {
    id: sourceIdFor(source),
    type: source.type,
    title: source.title || fallbackTitle,
    url: fetched.url,
    publishedAt: source.publishedAt ?? null,
    retrievedAt: fetched.retrievedAt,
    checksum: fetched.checksum,
  };
}

function sourceWithStoredMetadata(source) {
  return {
    ...source,
    publishedAt: source.publishedAt ?? null,
    retrievedAt: source.retrievedAt,
    checksum: source.checksum,
  };
}

async function mapWithConcurrency(items, worker, limit = 4) {
  const results = [];
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, consume));
  return results;
}

function actionForChange(changeBps, isFirst) {
  if (isFirst) return 'initial';
  if (changeBps === 0) return 'hold';
  return changeBps < 0 ? 'cut' : 'hike';
}

function mergeDecisionRecords(baseDecisions, records) {
  const byDate = new Map();
  for (const decision of baseDecisions) {
    byDate.set(decision.date, {
      ...decision,
      sourceIds: [...new Set(decision.sourceIds)],
    });
  }

  for (const record of records) {
    const existing = byDate.get(record.date);
    if (existing) {
      if (existing.repoRate !== record.repoRate) {
        throw new SourceParseError(
          `Conflicting repo rates for ${record.date}: ${existing.repoRate} and ${record.repoRate}`,
        );
      }
      existing.sourceIds = [...new Set([...existing.sourceIds, record.sourceId])];
      if (record.stance) existing.stance = record.stance;
      if (record.summary) existing.summary = record.summary;
      continue;
    }

    byDate.set(record.date, {
      id: `decision-${record.date}-${record.sourceId.slice(-8)}`,
      date: record.date,
      repoRate: record.repoRate,
      action: 'hold',
      changeBps: 0,
      stance: record.stance || null,
      summary: record.summary || null,
      sourceIds: [record.sourceId],
    });
  }

  const decisions = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return decisions.map((decision, index) => {
    const previous = decisions[index - 1];
    const changeBps = index === 0 ? 0 : Math.round((decision.repoRate - previous.repoRate) * 100);
    const action = actionForChange(changeBps, index === 0);
    return {
      ...decision,
      action,
      changeBps,
      sourceIds: [...new Set(decision.sourceIds)],
    };
  });
}

function transitionRows(rows) {
  return rows.filter((row, index) => index === 0 || row.repoRate !== rows[index - 1].repoRate);
}

function stableContent(snapshot) {
  return {
    schemaVersion: snapshot.schemaVersion,
    meta: {
      ...snapshot.meta,
      snapshotId: null,
      retrievedAt: null,
      checksum: null,
    },
    current: snapshot.current,
    sources: snapshot.sources.map(({ retrievedAt, ...source }) => source),
    decisions: snapshot.decisions,
    rateSeries: snapshot.rateSeries,
    events: snapshot.events,
    regimes: snapshot.regimes,
  };
}

function contentChecksum(snapshot) {
  return sha256(JSON.stringify(stableContent(snapshot)));
}

function buildSnapshot({
  baseline,
  retrievedAt,
  currentRates,
  archiveSource,
  policySources,
  policyDecisions,
  dbieSource,
  dbieRows,
}) {
  const sources = [
    ...baseline.sources.map(sourceWithStoredMetadata),
    archiveSource,
    ...policySources,
    currentRates.sourceRecord,
    ...(dbieSource ? [dbieSource] : []),
  ];
  const uniqueSources = [...new Map(sources.map(source => [source.id, source])).values()];

  const dbieRecords = dbieRows
    ? transitionRows(dbieRows).map(row => ({
      date: row.date,
      repoRate: row.repoRate,
      sourceId: dbieSource.id,
      stance: null,
      summary: 'RBI DBIE Key Rates transition',
    }))
    : [];

  const decisions = mergeDecisionRecords(
    baseline.decisions,
    [...dbieRecords, ...policyDecisions],
  );
  const latestDecision = decisions.at(-1);
  if (!latestDecision) throw new SourceParseError('No decision records remain after source merge');
  if (currentRates.repoRate !== latestDecision.repoRate) {
    throw new SourceParseError(
      `Current RBI page reports ${currentRates.repoRate}% but latest decision is ${latestDecision.repoRate}%`,
    );
  }

  const publishedDates = uniqueSources
    .map(source => source.publishedAt)
    .filter(Boolean)
    .sort();
  const currentSourceIds = [...new Set([
    ...latestDecision.sourceIds,
    currentRates.sourceRecord.id,
  ])];
  const snapshotWithoutChecksum = {
    schemaVersion: 2,
    meta: {
      snapshotId: `${todayFrom(retrievedAt)}-v2`,
      retrievedAt,
      latestOfficialDate: latestDecision.date,
      latestSourcePublishedAt: publishedDates.at(-1) || null,
      sourceUrl: currentRates.sourceRecord.url,
      checksum: null,
      generatedBy: 'scripts/fetch-rbi-data.js',
    },
    current: {
      repoRate: latestDecision.repoRate,
      effectiveDate: latestDecision.date,
      decisionId: latestDecision.id,
      stance: latestDecision.stance,
      sourceIds: currentSourceIds,
    },
    sources: uniqueSources,
    decisions,
    rateSeries: deriveRateSeries(decisions),
    events: baseline.events.map(({ dateObj, ...event }) => event),
    regimes: baseline.regimes.map(({ startObj, endObj, ...regime }) => regime),
  };

  const checksum = contentChecksum(snapshotWithoutChecksum);
  return assertValidSnapshotV2({
    ...snapshotWithoutChecksum,
    meta: {
      ...snapshotWithoutChecksum.meta,
      checksum,
    },
  });
}

async function fetchPolicyDocuments(entries) {
  return mapWithConcurrency(entries, async entry => {
    const fetched = await fetchText(entry.url);
    const parsed = parsePolicyDocument(fetched.body, entry, { url: fetched.url });
    const sourceRecord = enrichSource(parsed.source, fetched, entry.title);
    return {
      ...parsed,
      sourceRecord,
      sourceId: sourceRecord.id,
    };
  }, 4);
}

async function fetchDbieIfConfigured() {
  const url = process.env.RBI_DBIE_KEY_RATES_URL;
  if (!url) {
    console.warn('RBI_DBIE_KEY_RATES_URL is not configured; retaining the last validated historical series.');
    return null;
  }
  const fetched = await fetchText(url);
  const parsed = parseDbieKeyRates(fetched.body, {
    contentType: fetched.contentType,
    url: fetched.url,
  });
  return {
    ...parsed,
    sourceRecord: enrichSource(parsed.source, fetched),
  };
}

export async function runUpdate({ fetchImpl = globalThis.fetch, dryRun = DRY_RUN } = {}) {
  const baselineRaw = readJson(BUILD_SNAPSHOT);
  const baseline = migrateSnapshot(baselineRaw);
  const retrievedAt = new Date().toISOString();
  const currentFetched = await fetchText(
    process.env.RBI_CURRENT_RATES_URL || RBI_SOURCE_URLS.currentRates,
    { fetchImpl },
  );
  const currentParsed = parseCurrentPolicyRates(currentFetched.body, { url: currentFetched.url });
  const currentSourceRecord = enrichSource(currentParsed.source, currentFetched);
  const currentRates = { ...currentParsed, sourceRecord: currentSourceRecord };

  const archiveFetched = await fetchText(
    process.env.RBI_POLICY_ARCHIVE_URL || RBI_SOURCE_URLS.policyArchive,
    { fetchImpl },
  );
  const archiveEntries = parsePolicyArchive(archiveFetched.body, { url: archiveFetched.url });
  const archiveSource = enrichSource({
    type: 'policy-archive',
    title: 'RBI Monetary Policy archive',
    url: archiveFetched.url,
    publishedAt: null,
  }, archiveFetched);

  const resolutionEntries = archiveEntries.filter(entry => entry.type === 'policy-resolution');
  const minutesEntries = archiveEntries.filter(entry => entry.type === 'policy-minutes');
  const documentLimit = Number(process.env.RBI_POLICY_DOCUMENT_LIMIT || 12);
  const selectedEntries = [
    ...resolutionEntries.slice(-Math.max(documentLimit, 1)),
    ...minutesEntries.slice(-Math.max(documentLimit, 1)),
  ].sort((a, b) => a.publicationDate.localeCompare(b.publicationDate));
  if (resolutionEntries.length === 0) throw new SourceParseError('No RBI policy resolutions were selected');
  const documents = await fetchPolicyDocuments(selectedEntries);
  const policyDecisions = documents
    .filter(document => document.sourceRecord.type === 'policy-resolution')
    .map(document => {
      if (!document.decision) {
        throw new SourceParseError(`RBI policy resolution has no parseable repo-rate decision: ${document.sourceRecord.url}`);
      }
      return {
        ...document.decision,
        sourceId: document.sourceId,
      };
    });
  if (policyDecisions.length === 0) throw new SourceParseError('No source-backed RBI policy decisions were parsed');

  const dbie = await fetchDbieIfConfigured();
  const snapshot = buildSnapshot({
    baseline,
    retrievedAt,
    currentRates,
    archiveSource,
    policySources: documents.map(document => document.sourceRecord),
    policyDecisions,
    dbieSource: dbie?.sourceRecord || null,
    dbieRows: dbie?.rows || null,
  });

  const previousFingerprint = contentChecksum(baseline);
  const nextFingerprint = contentChecksum(snapshot);
  const contentChanged = previousFingerprint !== nextFingerprint;
  console.log(`Baseline snapshot: ${baseline.meta.snapshotId}`);
  console.log(`Current RBI repo rate: ${currentRates.repoRate}%`);
  console.log(`Latest official decision: ${snapshot.meta.latestOfficialDate}`);
  console.log(`Canonical decisions: ${snapshot.decisions.length}`);
  console.log(`Source records: ${snapshot.sources.length}`);
  console.log(`Source content changed: ${contentChanged ? 'yes' : 'no'}`);

  if (!contentChanged || dryRun) {
    if (dryRun) console.log('Dry run: no files written.');
    else console.log('No source content change: no files written.');
    return { snapshot, contentChanged, wrote: false };
  }

  const dateStr = todayFrom(retrievedAt);
  const snapshotPath = join(SNAPSHOTS_DIR, `${dateStr}.json`);
  mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  writeJson(snapshotPath, snapshot);
  writeJson(BUILD_SNAPSHOT, snapshot);

  const manifest = readJson(MANIFEST_PATH);
  const entry = {
    id: snapshot.meta.snapshotId,
    date: dateStr,
    file: `snapshots/${dateStr}.json`,
    checksum: snapshot.meta.checksum,
  };
  const existingIndex = manifest.snapshots.findIndex(item => item.date === dateStr);
  if (existingIndex >= 0) manifest.snapshots[existingIndex] = entry;
  else manifest.snapshots.push(entry);
  manifest.latest = dateStr;
  writeJson(MANIFEST_PATH, manifest);
  console.log(`Written snapshot: ${snapshotPath}`);
  console.log(`Updated build snapshot: ${BUILD_SNAPSHOT}`);
  console.log(`Updated manifest latest: ${dateStr}`);
  return { snapshot, contentChanged, wrote: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runUpdate().catch(error => {
    console.error(`${error.name}: ${error.message}`);
    if (error.cause) console.error(`Cause: ${error.cause.message}`);
    process.exitCode = 1;
  });
}
