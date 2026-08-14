const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACTIONS = new Set(['initial', 'cut', 'hike', 'hold']);

/**
 * SnapshotV2 is the build-time contract for the visualizer.
 *
 * decisions[] is canonical. rateSeries and rate-change views are derived
 * from it so an unchanged official decision cannot disappear from the UI.
 *
 * @typedef {Object} SnapshotV2
 * @property {2} schemaVersion
 * @property {Object} meta
 * @property {Object} current
 * @property {Array<Object>} sources
 * @property {Array<Object>} decisions
 * @property {Array<Object>} rateSeries
 * @property {Array<Object>} events
 * @property {Array<Object>} regimes
 */

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isValidUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function decisionId(index, date) {
  return `decision-${String(index + 1).padStart(3, '0')}-${date}`;
}

function actionForChange(changeBps, isFirst) {
  if (isFirst) return 'initial';
  if (changeBps === 0) return 'hold';
  return changeBps < 0 ? 'cut' : 'hike';
}

/**
 * Derive the effective-rate step series from the canonical decisions.
 * @param {Array<Object>} decisions
 * @returns {Array<Object>}
 */
export function deriveRateSeries(decisions) {
  return decisions.map(decision => ({
    date: decision.date,
    rate: decision.repoRate,
    source: decision.summary || '',
    decisionId: decision.id,
    action: decision.action,
    changeBps: decision.changeBps,
    stance: decision.stance ?? null,
    summary: decision.summary ?? null,
    sourceIds: [...decision.sourceIds],
  }));
}

/**
 * Derive non-zero rate changes from the canonical decisions.
 * @param {Array<Object>} decisions
 * @returns {Array<Object>}
 */
export function deriveRateChanges(decisions) {
  return deriveRateSeries(decisions).filter(decision => decision.changeBps !== 0);
}

/**
 * Validate the data contract without throwing, which makes the errors useful
 * to CI and to the ingestion script.
 * @param {unknown} snapshot
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSnapshotV2(snapshot) {
  const errors = [];

  if (!isObject(snapshot)) {
    return { valid: false, errors: ['snapshot must be an object'] };
  }

  if (snapshot.schemaVersion !== 2) errors.push('schemaVersion must be 2');

  if (!isObject(snapshot.meta)) {
    errors.push('meta must be an object');
  } else {
    if (typeof snapshot.meta.snapshotId !== 'string' || snapshot.meta.snapshotId.trim() === '') {
      errors.push('meta.snapshotId is required');
    }
    if (!isValidTimestamp(snapshot.meta.retrievedAt)) {
      errors.push('meta.retrievedAt must be a valid timestamp');
    }
    if (!isValidDateOnly(snapshot.meta.latestOfficialDate)) {
      errors.push('meta.latestOfficialDate must be a valid YYYY-MM-DD date');
    }
    if (snapshot.meta.latestSourcePublishedAt !== null &&
        !isValidTimestamp(snapshot.meta.latestSourcePublishedAt)) {
      errors.push('meta.latestSourcePublishedAt must be a valid timestamp or null');
    }
  }

  if (!isObject(snapshot.current)) {
    errors.push('current must be an object');
  } else {
    if (!Number.isFinite(snapshot.current.repoRate)) errors.push('current.repoRate is required');
    if (!isValidDateOnly(snapshot.current.effectiveDate)) {
      errors.push('current.effectiveDate must be a valid YYYY-MM-DD date');
    }
    if (typeof snapshot.current.decisionId !== 'string' || snapshot.current.decisionId.trim() === '') {
      errors.push('current.decisionId is required');
    }
    if (!Array.isArray(snapshot.current.sourceIds)) errors.push('current.sourceIds must be an array');
  }

  if (!Array.isArray(snapshot.sources)) {
    errors.push('sources must be an array');
  } else {
    const sourceIds = new Set();
    snapshot.sources.forEach((source, index) => {
      const prefix = `sources[${index}]`;
      if (!isObject(source)) {
        errors.push(`${prefix} must be an object`);
        return;
      }
      if (typeof source.id !== 'string' || source.id.trim() === '') errors.push(`${prefix}.id is required`);
      if (sourceIds.has(source.id)) errors.push(`duplicate source id: ${source.id}`);
      sourceIds.add(source.id);
      if (typeof source.type !== 'string' || source.type.trim() === '') errors.push(`${prefix}.type is required`);
      if (typeof source.title !== 'string' || source.title.trim() === '') errors.push(`${prefix}.title is required`);
      if (!isValidUrl(source.url)) errors.push(`${prefix}.url must be an http(s) URL`);
      if (source.publishedAt !== null && !isValidTimestamp(source.publishedAt)) {
        errors.push(`${prefix}.publishedAt must be a valid timestamp or null`);
      }
      if (!isValidTimestamp(source.retrievedAt)) errors.push(`${prefix}.retrievedAt must be a valid timestamp`);
      if (typeof source.checksum !== 'string' || source.checksum.trim() === '') {
        errors.push(`${prefix}.checksum is required`);
      }
    });
  }

  const knownSourceIds = new Set((snapshot.sources || []).map(source => source?.id));
  const knownDecisionIds = new Set();

  if (!Array.isArray(snapshot.decisions)) {
    errors.push('decisions must be an array');
  } else {
    let previousDate = null;
    snapshot.decisions.forEach((decision, index) => {
      const prefix = `decisions[${index}]`;
      if (!isObject(decision)) {
        errors.push(`${prefix} must be an object`);
        return;
      }
      if (typeof decision.id !== 'string' || decision.id.trim() === '') errors.push(`${prefix}.id is required`);
      if (knownDecisionIds.has(decision.id)) errors.push(`duplicate decision id: ${decision.id}`);
      knownDecisionIds.add(decision.id);
      if (!isValidDateOnly(decision.date)) errors.push(`${prefix}.date must be a valid YYYY-MM-DD date`);
      if (previousDate && isValidDateOnly(decision.date) && decision.date <= previousDate) {
        errors.push(`decisions must be strictly sorted by date at ${prefix}.date`);
      }
      if (isValidDateOnly(decision.date)) previousDate = decision.date;
      if (!Number.isFinite(decision.repoRate)) errors.push(`${prefix}.repoRate is required`);
      if (!Number.isInteger(decision.changeBps)) errors.push(`${prefix}.changeBps must be an integer`);
      if (!ACTIONS.has(decision.action)) errors.push(`${prefix}.action must be initial, cut, hike, or hold`);
      if (!Array.isArray(decision.sourceIds) || decision.sourceIds.length === 0) {
        errors.push(`${prefix}.sourceIds must contain at least one source id`);
      } else {
        decision.sourceIds.forEach(sourceId => {
          if (!knownSourceIds.has(sourceId)) errors.push(`${prefix} references unknown source id: ${sourceId}`);
        });
      }
      if (decision.stance !== null && decision.stance !== undefined && typeof decision.stance !== 'string') {
        errors.push(`${prefix}.stance must be a string or null`);
      }
      if (decision.summary !== null && decision.summary !== undefined && typeof decision.summary !== 'string') {
        errors.push(`${prefix}.summary must be a string or null`);
      }
    });
  }

  if (!Array.isArray(snapshot.rateSeries)) {
    errors.push('rateSeries must be an array');
  } else if (Array.isArray(snapshot.decisions)) {
    if (snapshot.rateSeries.length !== snapshot.decisions.length) {
      errors.push('rateSeries must have one point for every decision');
    }
    snapshot.rateSeries.forEach((point, index) => {
      const prefix = `rateSeries[${index}]`;
      if (!isObject(point)) {
        errors.push(`${prefix} must be an object`);
        return;
      }
      const decision = snapshot.decisions[index];
      if (!isValidDateOnly(point.date)) errors.push(`${prefix}.date must be a valid YYYY-MM-DD date`);
      if (!Number.isFinite(point.rate)) errors.push(`${prefix}.rate is required`);
      if (decision && point.decisionId !== decision.id) errors.push(`${prefix}.decisionId must match decisions[${index}].id`);
      if (decision && point.date !== decision.date) errors.push(`${prefix}.date must match decisions[${index}].date`);
      if (decision && point.rate !== decision.repoRate) errors.push(`${prefix}.rate must match decisions[${index}].repoRate`);
    });
  }

  if (!Array.isArray(snapshot.events)) errors.push('events must be an array');
  if (!Array.isArray(snapshot.regimes)) errors.push('regimes must be an array');

  if (Array.isArray(snapshot.decisions) && snapshot.decisions.length > 0 && isObject(snapshot.current)) {
    const latestDecision = snapshot.decisions.at(-1);
    if (snapshot.meta?.latestOfficialDate !== latestDecision.date) {
      errors.push('meta.latestOfficialDate must match the latest decision date');
    }
    if (snapshot.current.decisionId !== latestDecision.id) errors.push('current.decisionId must match the latest decision');
    if (snapshot.current.effectiveDate !== latestDecision.date) errors.push('current.effectiveDate must match the latest decision date');
    if (snapshot.current.repoRate !== latestDecision.repoRate) errors.push('current.repoRate must match the latest decision rate');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate and return a SnapshotV2, or fail with all contract errors.
 * @param {unknown} snapshot
 * @returns {SnapshotV2}
 */
export function assertValidSnapshotV2(snapshot) {
  const result = validateSnapshotV2(snapshot);
  if (!result.valid) {
    throw new Error(`Invalid SnapshotV2:\n${result.errors.map(error => `- ${error}`).join('\n')}`);
  }
  return snapshot;
}

/**
 * Convert the repository's pre-V2 snapshot to SnapshotV2. The old snapshot is
 * intentionally left untouched as a raw historical artifact.
 * @param {Object} legacy
 * @returns {SnapshotV2}
 */
export function migrateLegacySnapshot(legacy) {
  if (!isObject(legacy) || !Array.isArray(legacy.rates)) {
    throw new Error('Cannot migrate snapshot without a rates array');
  }

  const sourceId = 'legacy-snapshot';
  const retrievedAt = legacy.fetched_at;
  const source = {
    id: sourceId,
    type: 'historical-rate-series',
    title: 'RBI repo rate historical snapshot (legacy import)',
    url: legacy.source_url,
    publishedAt: null,
    retrievedAt,
    checksum: legacy.checksum,
  };

  const decisions = legacy.rates.map((rate, index, rates) => {
    const previousRate = rates[index - 1]?.rate;
    const changeBps = index === 0 ? 0 : Math.round((rate.rate - previousRate) * 100);
    return {
      id: decisionId(index, rate.date),
      date: rate.date,
      repoRate: rate.rate,
      action: actionForChange(changeBps, index === 0),
      changeBps,
      stance: null,
      summary: rate.source || null,
      sourceIds: [sourceId],
    };
  });

  const latestDecision = decisions.at(-1);
  const migrated = {
    schemaVersion: 2,
    meta: {
      snapshotId: legacy.snapshot_id,
      retrievedAt,
      latestOfficialDate: latestDecision?.date,
      latestSourcePublishedAt: null,
      sourceUrl: legacy.source_url,
      checksum: legacy.checksum,
      migratedFrom: 'legacy-v1',
    },
    current: latestDecision ? {
      repoRate: latestDecision.repoRate,
      effectiveDate: latestDecision.date,
      decisionId: latestDecision.id,
      stance: latestDecision.stance,
      sourceIds: [...latestDecision.sourceIds],
    } : {
      repoRate: null,
      effectiveDate: null,
      decisionId: null,
      stance: null,
      sourceIds: [],
    },
    sources: [source],
    decisions,
    rateSeries: deriveRateSeries(decisions),
    events: (legacy.events || []).map((event, index) => ({
      id: event.id || `event-${String(index + 1).padStart(3, '0')}-${event.date}`,
      ...event,
    })),
    regimes: legacy.regimes || [],
  };

  return assertValidSnapshotV2(migrated);
}

/**
 * Accept either the new contract or the legacy snapshot while the raw
 * migration is being rolled through the repository.
 * @param {Object} input
 * @returns {SnapshotV2}
 */
export function migrateSnapshot(input) {
  if (input?.schemaVersion === 2) return assertValidSnapshotV2(input);
  return migrateLegacySnapshot(input);
}
