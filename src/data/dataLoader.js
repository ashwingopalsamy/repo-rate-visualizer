import snapshotData from './snapshot.json' with { type: 'json' };
import {
  deriveRateChanges,
  deriveRateSeries,
  migrateSnapshot,
  assertValidSnapshotV2,
} from './snapshotV2.js';
import { bundledRelease } from './releaseMeta.js';
import { coverageSummary, enrichDecision } from '../lib/evidence.js';

// The raw snapshot is bundled at build time and normalized to SnapshotV2.
// To update: run the verified RBI ingestion pipeline.
export const snapshot = assertValidSnapshotV2(migrateSnapshot(snapshotData));

function releaseIdForChecksum(checksum) {
  return `snapshot-${String(checksum || '').replace(/^sha256:/, '')}`;
}

if (bundledRelease.releaseId !== releaseIdForChecksum(snapshot.meta.checksum)) {
  throw new Error('Bundled snapshot checksum does not match its release identity.');
}

const decisionsById = new Map(snapshot.decisions.map(decision => [decision.id, decision]));

export const sources = snapshot.sources;

const enrichedDecisions = snapshot.decisions.map(decision => enrichDecision(decision, sources));
const latestRecord = enrichedDecisions.at(-1);

// Parsed rate data derived from decisions, with Date objects for chart scales.
export const repoRateData = deriveRateSeries(snapshot.decisions).map(point => {
  const decision = decisionsById.get(point.decisionId);
  return {
    ...point,
    source: decision?.summary || point.source,
    dateObj: new Date(`${point.date}T00:00:00.000Z`),
  };
});

export const currentRate = repoRateData[repoRateData.length - 1];

export const previousRate = repoRateData.length > 1
  ? repoRateData[repoRateData.length - 2]
  : null;

// Events with parsed dates
export const macroEvents = snapshot.events.map(e => ({
  ...e,
  dateObj: new Date(`${e.date}T00:00:00.000Z`),
}));

// Regimes with parsed dates
export const regimes = snapshot.regimes.map(r => ({
  ...r,
  startObj: new Date(`${r.startDate}T00:00:00.000Z`),
  endObj: new Date(`${r.endDate}T00:00:00.000Z`),
}));

// Current regime (last in the array)
export const currentRegime = regimes[regimes.length - 1];

// Rate changes for bar chart, derived from the canonical decisions.
export const rateChanges = deriveRateChanges(snapshot.decisions).map(point => ({
  ...point,
  source: decisionsById.get(point.decisionId)?.summary || point.source,
  dateObj: new Date(`${point.date}T00:00:00.000Z`),
}));

// Decisions and source records are exported for the ledger and provenance views.
export const decisions = enrichedDecisions.map(decision => ({
  ...decision,
  dateObj: new Date(`${decision.date}T00:00:00.000Z`),
}));

export const coverage = coverageSummary(decisions, sources);

// Metadata
export const snapshotMeta = {
  schemaVersion: snapshot.schemaVersion,
  id: snapshot.meta.snapshotId,
  snapshotId: snapshot.meta.snapshotId,
  releaseId: bundledRelease.releaseId,
  artifactSha256: bundledRelease.artifactSha256,
  artifactPath: bundledRelease.artifactPath,
  legacySnapshotId: bundledRelease.legacySnapshotId,
  fetchedAt: snapshot.meta.retrievedAt,
  retrievedAt: snapshot.meta.retrievedAt,
  sourceUrl: snapshot.meta.sourceUrl || snapshot.sources[0]?.url || '',
  checksum: snapshot.meta.checksum || snapshot.sources[0]?.checksum || '',
  latestOfficialDate: snapshot.meta.latestOfficialDate,
  latestRecordedDate: snapshot.meta.latestRecordedDate || latestRecord?.date || null,
  latestSourcePublishedAt: snapshot.meta.latestSourcePublishedAt,
  generatedBy: snapshot.meta.generatedBy || 'scripts/fetch-rbi-data.js',
  coverage,
};

export const snapshotRelease = Object.freeze({
  ...snapshotMeta,
  snapshotId: snapshotMeta.snapshotId,
  sources,
});

/**
 * Fetch the latest manifest to check for newer snapshots.
 * Returns null if the manifest is unreachable (offline/CDN miss) so the
 * baked-in snapshot remains authoritative without a runtime failure.
 */
export async function fetchManifest() {
  try {
    const response = await fetch('/data/manifest.json');
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function manifestEntryFor(manifest, releaseId) {
  return (manifest?.snapshots || []).find(entry => (
    entry.releaseId === releaseId
    || entry.id === releaseId
  )) || null;
}

function isAllowedArchivePath(file) {
  return /^snapshots\/[A-Za-z0-9._-]+\.json$/.test(file || '');
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
    throw new Error('This browser cannot verify archived snapshot checksums.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolve a pinned release without ever silently falling back to the latest
 * snapshot. The current release remains bundled and offline-capable; older
 * releases are fetched only through a manifest allow-list and verified by
 * exact artifact digest before being accepted.
 */
export async function loadSnapshotRelease(releaseId) {
  if (!releaseId || releaseId === snapshotMeta.releaseId) {
    return { snapshot, release: snapshotRelease, fromBundle: true };
  }

  const manifest = await fetchManifest();
  const entry = manifestEntryFor(manifest, releaseId);
  const resolvedReleaseId = entry?.releaseId || entry?.id;
  if (!entry || !entry.artifactSha256 || !resolvedReleaseId || !isAllowedArchivePath(entry.file)) {
    throw new Error(`Snapshot release ${releaseId} is not available as a verified archive.`);
  }

  const response = await fetch(`/data/${entry.file}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Snapshot release ${releaseId} could not be fetched.`);
  const rawText = await response.text();
  const actualDigest = await sha256Hex(new TextEncoder().encode(rawText));
  if (actualDigest !== entry.artifactSha256) {
    throw new Error(`Snapshot release ${releaseId} failed artifact verification.`);
  }

  const archivedSnapshot = assertValidSnapshotV2(migrateSnapshot(JSON.parse(rawText)));
  if (resolvedReleaseId !== releaseIdForChecksum(archivedSnapshot.meta.checksum)) {
    throw new Error(`Snapshot release ${releaseId} failed release identity verification.`);
  }
  if (entry.checksum && entry.checksum !== archivedSnapshot.meta.checksum) {
    throw new Error(`Snapshot release ${releaseId} failed content checksum verification.`);
  }
  const archivedSources = archivedSnapshot.sources;
  const archivedDecisions = archivedSnapshot.decisions.map(decision => enrichDecision(decision, archivedSources));
  return {
    snapshot: archivedSnapshot,
    release: {
      releaseId: resolvedReleaseId,
      artifactSha256: entry.artifactSha256,
      artifactPath: entry.file,
      snapshotId: entry.legacyId || archivedSnapshot.meta.snapshotId,
      retrievedAt: archivedSnapshot.meta.retrievedAt,
      schemaVersion: archivedSnapshot.schemaVersion,
      checksum: archivedSnapshot.meta.checksum,
      latestOfficialDate: archivedSnapshot.meta.latestOfficialDate,
      latestRecordedDate: archivedSnapshot.meta.latestRecordedDate || archivedDecisions.at(-1)?.date || null,
      coverage: coverageSummary(archivedDecisions, archivedSources),
      sources: archivedSources,
    },
    fromBundle: false,
  };
}

/**
 * Check whether a newer snapshot is available relative to the baked-in build.
 * Compares the manifest's `latest` field against the bundled snapshot date.
 */
export async function checkForUpdate() {
  const manifest = await fetchManifest();
  if (!manifest) return { available: false, manifest: null };
  const bundledDate = snapshotMeta.latestRecordedDate || '';
  const latestDate = manifest.latest || '';
  return {
    available: (manifest.latestReleaseId || latestDate) !== snapshotMeta.releaseId,
    manifest,
    bundledDate,
    latestDate,
  };
}
