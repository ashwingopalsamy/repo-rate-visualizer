import { isWithinDateRange, isWithinRegime } from '../lib/dateBoundaries.js';
import { classifyEvidence } from '../lib/evidence.js';

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

/**
 * Build a provenance-complete decision export without depending on the DOM.
 * Decisions remain the canonical export rows; rate-change views are derived.
 */
export function buildDecisionCsv({ decisions, sources, macroEvents, regimes, dateRange, snapshotMeta = {} }) {
  const sourceById = new Map(sources.map(source => [source.id, source]));
  let data = decisions;

  data = data.filter(decision => isWithinDateRange(decision.dateObj || decision.date, dateRange));

  const headers = [
    'Decision ID',
    'Record Type',
    'Evidence Status',
    'Date',
    'Decision Date',
    'Effective Date',
    'Source Publication Date(s)',
    'Repo Rate (%)',
    'Action',
    'Change (bps)',
    'Stance',
    'Decision Summary',
    'Source ID(s)',
    'Source Title(s)',
    'Source URL(s)',
    'Event',
    'Regime',
    'Snapshot Release ID',
    'Snapshot Artifact SHA-256',
    'Snapshot Retrieved At',
    'Snapshot Content Checksum',
  ];

  const rows = data.map(decision => {
    const event = macroEvents.find(item => item.date === decision.date)?.label || '';
    const regime = regimes.find((item, index) => isWithinRegime(decision.dateObj, item, index === regimes.length - 1))?.label || '';
    const decisionSources = decision.sourceIds.map(sourceId => sourceById.get(sourceId)).filter(Boolean);
    const evidence = classifyEvidence(decision, sources);
    const recordedChange = decision.action === 'initial' ? '' : (decision.changeBps ?? '');

    return [
      decision.id,
      decision.recordType || evidence.recordType,
      decision.evidenceStatus || evidence.evidenceStatus,
      decision.date,
      decision.decisionDate || '',
      decision.effectiveDate || '',
      decisionSources.map(source => source.publishedAt || '').filter(Boolean).join(' | '),
      decision.repoRate,
      decision.action,
      recordedChange,
      decision.stance || '',
      decision.summary || '',
      decision.sourceIds.join(' | '),
      decisionSources.map(source => source.title).join(' | '),
      decisionSources.map(source => source.url).join(' | '),
      event,
      regime,
      snapshotMeta.releaseId || '',
      snapshotMeta.artifactSha256 || '',
      snapshotMeta.retrievedAt || '',
      snapshotMeta.checksum || '',
    ].map(csvCell).join(',');
  });

  return [headers.map(csvCell).join(','), ...rows].join('\n');
}
