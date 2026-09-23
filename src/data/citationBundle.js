import { coverageSummary, classifyEvidence, actionForRecord } from '../lib/evidence.js';
import { isWithinDateRange, isWithinRegime } from '../lib/dateBoundaries.js';

export const CITATION_FORMAT_VERSION = 1;

function sourceForDecision(decision, sourceById) {
  return (decision?.sourceIds || [])
    .map(sourceId => sourceById.get(sourceId))
    .filter(Boolean)
    .map(source => ({
      id: source.id,
      type: source.type,
      title: source.title,
      url: source.url,
      publishedAt: source.publishedAt ?? null,
      retrievedAt: source.retrievedAt ?? null,
      checksum: source.checksum ?? null,
    }));
}

function rangeLabel(dateRange = {}) {
  return `${dateRange.start || 'all'}_${dateRange.end || 'all'}`;
}

export function citationFilename({ format, view = 'timeline', dateRange = {}, releaseId = 'current' } = {}) {
  const safeRelease = String(releaseId).replace(/[^a-zA-Z0-9-]/g, '-');
  return `rbi-repo-rate--${safeRelease}--${view}--${rangeLabel(dateRange)}.${format}`;
}

export function buildCitationText({ decision, release, projectUrl = 'https://github.com/ashwingopalsamy/repo-rate-visualizer', dossierUrl }) {
  if (!decision) return '';
  const evidence = classifyEvidence(decision, release.sources || []);
  const recordLabel = evidence.isDirectDecision ? 'policy decision' : 'rate observation';
  const limitation = evidence.isDirectDecision
    ? 'Direct RBI policy-resolution evidence.'
    : 'Historical rate observation; not a direct RBI decision-resolution citation.';
  const source = (decision.sourceIds || [])
    .map(sourceId => release.sources.find(item => item.id === sourceId))
    .find(Boolean);
  const sourceLabel = source ? `${source.title} (${source.url})` : 'source not reported';
  const location = dossierUrl || `${projectUrl}/decision/${encodeURIComponent(decision.id)}?snapshot=${encodeURIComponent(release.releaseId)}`;
  const checksum = release.checksum || 'not reported';
  const artifact = release.artifactSha256 || 'not reported';
  return [
    `RBI Repo Rate Visualizer, ${recordLabel} dated ${decision.date}, repo rate ${decision.repoRate.toFixed(2)}%.`,
    `Snapshot ${release.releaseId}, retrieved ${release.retrievedAt || 'not reported'}, content checksum ${checksum}, artifact SHA-256 ${artifact}.`,
    `Source: ${sourceLabel}.`,
    limitation,
    `Record: ${location}`,
  ].join(' ');
}

export function buildCitationBundle({
  decisions = [],
  sources = [],
  macroEvents = [],
  regimes = [],
  dateRange = {},
  release,
  scope = {},
  selectedDecisionId = null,
  projectUrl,
} = {}) {
  const sourceById = new Map(sources.map(source => [source.id, source]));
  const selected = decisions.filter(decision => {
    return isWithinDateRange(decision.dateObj || decision.date, dateRange);
  });
  const releaseInfo = {
    releaseId: release?.releaseId || 'unversioned',
    artifactSha256: release?.artifactSha256 || null,
    checksum: release?.checksum || null,
    snapshotId: release?.snapshotId || null,
    retrievedAt: release?.retrievedAt || null,
    schemaVersion: release?.schemaVersion || 2,
    coverage: release?.coverage || null,
    sources,
  };
  const coverage = coverageSummary(selected, sources);
  const records = selected.map(decision => ({
    id: decision.id,
    recordType: decision.recordType || classifyEvidence(decision, sources).recordType,
    evidenceStatus: decision.evidenceStatus || classifyEvidence(decision, sources).evidenceStatus,
    evidenceLabel: decision.evidenceLabel || classifyEvidence(decision, sources).evidenceLabel,
    date: decision.date,
    observationDate: decision.observationDate ?? decision.date,
    decisionDate: decision.decisionDate ?? null,
    effectiveDate: decision.effectiveDate ?? null,
    repoRate: decision.repoRate,
    action: actionForRecord(decision),
    changeBps: decision.action === 'initial' ? null : decision.changeBps,
    stance: decision.stance ?? null,
    summary: decision.summary ?? null,
    sources: sourceForDecision(decision, sourceById),
    event: macroEvents.find(event => event.date === decision.date)?.label || null,
    regime: regimes.find((regime, index) => isWithinRegime(
      decision.dateObj || decision.date,
      regime,
      index === regimes.length - 1,
    ))?.label || null,
  }));
  const selectedDecision = selected.find(decision => decision.id === selectedDecisionId) || null;
  const dossierUrl = selectedDecision
    ? `${projectUrl || 'https://github.com/ashwingopalsamy/repo-rate-visualizer'}/decision/${encodeURIComponent(selectedDecision.id)}?snapshot=${encodeURIComponent(releaseInfo.releaseId)}`
    : null;

  return {
    formatVersion: CITATION_FORMAT_VERSION,
    release: {
      releaseId: releaseInfo.releaseId,
      artifactSha256: releaseInfo.artifactSha256,
      checksum: releaseInfo.checksum,
      snapshotId: releaseInfo.snapshotId,
      artifactPath: release?.artifactPath || null,
      legacySnapshotId: release?.legacySnapshotId || null,
      retrievedAt: releaseInfo.retrievedAt,
      schemaVersion: releaseInfo.schemaVersion,
      coverage: releaseInfo.coverage,
    },
    scope: {
      ...scope,
      start: dateRange.start || null,
      end: dateRange.end || null,
      selectedDecisionId,
    },
    coverage,
    records,
    sources: sources.map(source => ({
      id: source.id,
      type: source.type,
      title: source.title,
      url: source.url,
      publishedAt: source.publishedAt ?? null,
      retrievedAt: source.retrievedAt ?? null,
      checksum: source.checksum ?? null,
    })),
    citationText: selectedDecision
      ? buildCitationText({ decision: selectedDecision, release: releaseInfo, projectUrl, dossierUrl })
      : '',
  };
}
