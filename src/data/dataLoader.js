import snapshotData from './snapshot.json';
import {
  deriveRateChanges,
  deriveRateSeries,
  migrateSnapshot,
  assertValidSnapshotV2,
} from './snapshotV2.js';

// The raw snapshot is bundled at build time and normalized to SnapshotV2.
// To update: run the verified RBI ingestion pipeline.
export const snapshot = assertValidSnapshotV2(migrateSnapshot(snapshotData));

const decisionsById = new Map(snapshot.decisions.map(decision => [decision.id, decision]));

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
export const decisions = snapshot.decisions.map(decision => ({
  ...decision,
  dateObj: new Date(`${decision.date}T00:00:00.000Z`),
}));

export const sources = snapshot.sources;

// Metadata
export const snapshotMeta = {
  id: snapshot.meta.snapshotId,
  fetchedAt: snapshot.meta.retrievedAt,
  retrievedAt: snapshot.meta.retrievedAt,
  sourceUrl: snapshot.meta.sourceUrl || snapshot.sources[0]?.url || '',
  checksum: snapshot.meta.checksum || snapshot.sources[0]?.checksum || '',
  latestOfficialDate: snapshot.meta.latestOfficialDate,
  latestSourcePublishedAt: snapshot.meta.latestSourcePublishedAt,
};
