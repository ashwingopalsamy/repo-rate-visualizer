import {
  currentRate,
  decisions,
  macroEvents,
  regimes,
  snapshotMeta,
  snapshotRelease,
  sources as indiaSources,
} from './dataLoader.js';
import { indiaCountrySnapshot, loadCountrySnapshot } from './countrySnapshot.js';
import { latestDirectDecision } from '../lib/evidence.js';

const actionFromChange = changeBps => changeBps === null
  ? 'framework'
  : changeBps === undefined
    ? 'observation'
    : changeBps > 0 ? 'hike' : changeBps < 0 ? 'cut' : 'hold';

function indiaModel(entry) {
  const releaseSnapshot = indiaCountrySnapshot();
  const records = decisions.map(record => ({
    id: record.id,
    recordDate: record.date,
    decisionDate: record.decisionDate || null,
    effectiveDate: record.effectiveDate || null,
    recordType: record.recordType || 'rate_observation',
    value: { kind: 'point', lowBps: Math.round(record.repoRate * 100), highBps: Math.round(record.repoRate * 100) },
    changeBps: record.changeBps,
    sourceIds: record.sourceIds || [],
    action: record.action || actionFromChange(record.changeBps),
    evidenceStatus: record.evidenceStatus || null,
    stance: record.stance || null,
    summary: record.summary || null,
    legacyRecord: record,
  }));
  const latest = records.at(-1);
  const latestDirectRecord = latestDirectDecision(decisions, indiaSources);
  return Object.freeze({
    code: 'IN',
    name: entry?.name || 'India',
    centralBank: entry?.centralBank || 'Reserve Bank of India',
    instrument: entry?.instrument || 'Policy repo rate',
    locale: entry?.locale || 'en-IN',
    unit: 'percent',
    entry,
    snapshot: releaseSnapshot,
    records,
    sources: indiaSources,
    coverage: {
      from: records[0]?.recordDate || null,
      through: records.at(-1)?.recordDate || null,
      totalRecords: records.length,
      directDecisionRecords: snapshotMeta.coverage.directDecisionRecords,
      historicalObservationRecords: snapshotMeta.coverage.historicalObservationRecords,
    },
    release: {
      ...snapshotMeta,
      ...snapshotRelease,
      artifactSha256: snapshotMeta.artifactSha256,
    },
    context: { macroEvents, regimes, frameworks: releaseSnapshot.frameworks },
    latestRecorded: latest,
    latestDecision: records.find(record => record.id === latestDirectRecord?.id) || null,
    capabilities: { holds: true, framework: false, context: true, stance: true, range: false },
    sourceLabels: {
      short: 'RBI source',
      history: 'Historical repo-rate evidence',
      record: 'Rate record',
    },
    getCurrentValue: () => ({ kind: 'point', lowBps: Math.round(currentRate.rate * 100), highBps: Math.round(currentRate.rate * 100) }),
  });
}

function genericModel(entry, snapshot) {
  const sourceById = new Map(snapshot.sources.map(source => [source.id, source]));
  const records = snapshot.records.map(record => ({
    ...record,
    date: record.recordDate,
    action: record.changeBps === 0 && record.recordType !== 'policy_decision'
      ? 'observation'
      : actionFromChange(record.changeBps),
    evidenceStatus: 'published-change',
    stance: null,
    summary: record.recordType === 'policy_change' ? 'Published target change' : 'Rate observation',
    sourceLabels: record.sourceIds.map(id => sourceById.get(id)?.title).filter(Boolean),
  }));
  const latest = records.at(-1);
  return Object.freeze({
    code: snapshot.country,
    name: entry.name,
    centralBank: snapshot.centralBank || entry.centralBank,
    instrument: snapshot.instrument || entry.instrument,
    locale: entry.locale || 'en-US',
    unit: 'percent',
    entry,
    snapshot,
    records,
    sources: snapshot.sources,
    coverage: {
      ...snapshot.coverage,
      totalRecords: records.length,
      directDecisionRecords: 0,
      historicalObservationRecords: 0,
    },
    release: {
      releaseId: entry.releaseId || snapshot.releaseId || 'Not reported',
      artifactSha256: entry.sha256 || null,
      retrievedAt: entry.retrievedAt || snapshot.retrievedAt || null,
      latestRecordedDate: latest?.recordDate || null,
      coverage: { ...snapshot.coverage, totalRecords: records.length },
    },
    context: { macroEvents: [], regimes: [], frameworks: snapshot.frameworks || [] },
    latestRecorded: latest,
    latestDecision: null,
    capabilities: {
      holds: records.some(record => record.recordType === 'policy_decision' && record.changeBps === 0),
      framework: records.some(record => record.changeBps === null || record.recordType === 'framework_change'),
      context: Boolean(snapshot.macroEvents?.length || snapshot.regimes?.length),
      stance: records.some(record => record.stance),
      range: records.some(record => record.value.kind === 'range' && record.value.lowBps !== record.value.highBps),
    },
    sourceLabels: {
      short: `${entry.code} source`,
      history: `Historical ${entry.instrument} evidence`,
      record: 'Published changes',
    },
    getCurrentValue: () => latest?.value || null,
  });
}

export function createCountryModel(entry, snapshot) {
  if (!entry || entry.status !== 'available') throw new Error('Country is not available.');
  if (entry.code === 'IN') return indiaModel(entry);
  if (!snapshot || snapshot.country !== entry.code) throw new Error('Country release does not match the selected country.');
  return genericModel(entry, snapshot);
}

export async function loadCountryModel(entry) {
  const snapshot = await loadCountrySnapshot(entry);
  return createCountryModel(entry, snapshot);
}

export function getRecordAction(record) {
  return record?.action || actionFromChange(record?.changeBps);
}

export function formatCountryValue(value, { compact = false } = {}) {
  if (!value || !Number.isInteger(value.lowBps) || !Number.isInteger(value.highBps)) return 'Not reported';
  const lower = (value.lowBps / 100).toFixed(2);
  const upper = (value.highBps / 100).toFixed(2);
  if (value.kind === 'range' && value.lowBps !== value.highBps) return `${lower}–${upper}%`;
  return `${lower}%`;
}

export function formatCountryChange(record) {
  if (record?.changeBps === null) return 'Framework change';
  if (!Number.isInteger(record?.changeBps)) return 'Change not reported';
  if (record.changeBps === 0) return '0 bps';
  return `${record.changeBps > 0 ? '+' : ''}${record.changeBps} bps`;
}
