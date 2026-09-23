const PRIMARY_SOURCE_TYPES = new Set(['policy-resolution']);
const OFFICIAL_CONTEXT_SOURCE_TYPES = new Set([
  'policy-archive',
  'policy-minutes',
  'current-policy-rates',
]);
const HISTORICAL_SOURCE_TYPES = new Set([
  'historical-rate-series',
  'secondary-historical-reference',
]);

export const EVIDENCE_STATUS = Object.freeze({
  PRIMARY_DECISION: 'primary-decision',
  OFFICIAL_CONTEXT: 'official-context',
  HISTORICAL_SECONDARY: 'historical-secondary',
  MIXED: 'mixed',
});

export const RECORD_TYPE = Object.freeze({
  POLICY_DECISION: 'policy_decision',
  RATE_OBSERVATION: 'rate_observation',
});

export const EVIDENCE_LABELS = Object.freeze({
  [EVIDENCE_STATUS.PRIMARY_DECISION]: 'Direct RBI policy decision',
  [EVIDENCE_STATUS.OFFICIAL_CONTEXT]: 'Official RBI context',
  [EVIDENCE_STATUS.HISTORICAL_SECONDARY]: 'Historical rate observation',
  [EVIDENCE_STATUS.MIXED]: 'Mixed evidence record',
});

function sourceTypesFor(decision, sourceById) {
  return [...new Set((decision?.sourceIds || [])
    .map(sourceId => sourceById.get(sourceId)?.type)
    .filter(Boolean))];
}

export function classifyEvidence(decision, sources = []) {
  const sourceById = sources instanceof Map
    ? sources
    : new Map(sources.map(source => [source.id, source]));
  const sourceTypes = sourceTypesFor(decision, sourceById);
  const hasPrimary = sourceTypes.some(type => PRIMARY_SOURCE_TYPES.has(type));
  const hasOfficialContext = sourceTypes.some(type => OFFICIAL_CONTEXT_SOURCE_TYPES.has(type));
  const hasHistorical = sourceTypes.some(type => HISTORICAL_SOURCE_TYPES.has(type));

  let status = EVIDENCE_STATUS.OFFICIAL_CONTEXT;
  if (hasPrimary && (hasOfficialContext || hasHistorical)) status = EVIDENCE_STATUS.MIXED;
  else if (hasPrimary) status = EVIDENCE_STATUS.PRIMARY_DECISION;
  else if (hasHistorical) status = EVIDENCE_STATUS.HISTORICAL_SECONDARY;

  return {
    recordType: hasPrimary ? RECORD_TYPE.POLICY_DECISION : RECORD_TYPE.RATE_OBSERVATION,
    evidenceStatus: status,
    evidenceLabel: EVIDENCE_LABELS[status],
    sourceTypes,
    isDirectDecision: hasPrimary,
  };
}

export function enrichDecision(decision, sources = []) {
  return { ...decision, ...classifyEvidence(decision, sources) };
}

export function coverageSummary(decisions = [], sources = []) {
  const enriched = decisions.map(decision => classifyEvidence(decision, sources));
  return {
    totalRecords: decisions.length,
    directDecisionRecords: enriched.filter(item => item.isDirectDecision).length,
    officialContextRecords: enriched.filter(item => item.evidenceStatus === EVIDENCE_STATUS.OFFICIAL_CONTEXT).length,
    historicalObservationRecords: enriched.filter(item => item.evidenceStatus === EVIDENCE_STATUS.HISTORICAL_SECONDARY).length,
    mixedRecords: enriched.filter(item => item.evidenceStatus === EVIDENCE_STATUS.MIXED).length,
  };
}

export function latestDirectDecision(decisions = [], sources = []) {
  return decisions
    .filter(decision => classifyEvidence(decision, sources).isDirectDecision)
    .at(-1) || null;
}

export function actionForRecord(decision) {
  if (decision?.action === 'initial') return 'Initial observation';
  if (decision?.action === 'cut') return 'Rate cut';
  if (decision?.action === 'hike') return 'Rate hike';
  if (decision?.action === 'hold') return 'Rate hold';
  return 'Action not reported';
}

export function isCountableHold(decision) {
  return decision?.action === 'hold';
}
