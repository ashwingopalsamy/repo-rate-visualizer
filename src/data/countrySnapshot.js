import { snapshot, snapshotMeta } from './dataLoader.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function indiaCountrySnapshot() {
  return {
    schemaVersion: 1,
    country: 'IN',
    centralBank: 'Reserve Bank of India',
    instrument: 'Policy repo rate',
    frameworks: [{ from: '2000-06-05', to: null, label: 'Repo-rate series; decision evidence varies by record' }],
    coverage: { from: snapshot.decisions[0]?.date, through: snapshot.decisions.at(-1)?.date, grain: 'Rate observations and directly evidenced policy decisions' },
    retrievedAt: snapshotMeta.retrievedAt,
    releaseId: snapshotMeta.releaseId,
    sources: snapshot.sources.map(source => ({
      id: source.id,
      title: source.title,
      url: source.url,
      type: source.type,
      publishedAt: source.publishedAt || null,
      retrievedAt: source.retrievedAt || snapshotMeta.retrievedAt,
      checksum: source.checksum || null,
    })),
    records: snapshot.decisions.map(record => ({
      id: record.id,
      recordDate: record.date,
      decisionDate: record.decisionDate || null,
      effectiveDate: record.effectiveDate || null,
      recordType: record.recordType === 'policy_decision' ? 'policy_decision' : 'rate_observation',
      value: { kind: 'point', lowBps: Math.round(record.repoRate * 100), highBps: Math.round(record.repoRate * 100) },
      changeBps: record.changeBps,
      sourceIds: record.sourceIds,
    })),
  };
}

export function validateCountrySnapshot(value, expectedCountry) {
  if (value?.schemaVersion !== 1 || value.country !== expectedCountry || !Array.isArray(value.sources) || !Array.isArray(value.records) || !value.records.length) {
    throw new Error('Invalid country snapshot.');
  }
  const sources = new Set(value.sources.map(source => source.id));
  let previous = '';
  for (const record of value.records) {
    const { lowBps, highBps, kind } = record.value || {};
    if (!DATE.test(record.recordDate) || record.recordDate <= previous ||
      !['point', 'range'].includes(kind) || !Number.isInteger(lowBps) || !Number.isInteger(highBps) ||
      lowBps > highBps || (kind === 'point' && lowBps !== highBps) ||
      !['policy_change', 'policy_decision', 'rate_observation'].includes(record.recordType) ||
      !Array.isArray(record.sourceIds) || !record.sourceIds.every(id => sources.has(id)) ||
      (record.effectiveDate != null && !DATE.test(record.effectiveDate)) ||
      (record.decisionDate != null && !DATE.test(record.decisionDate))) {
      throw new Error(`Invalid country record ${record.id || ''}.`);
    }
    previous = record.recordDate;
  }
  return value;
}

export async function loadCountryManifest() {
  const response = await fetch('/data/countries/manifest.json');
  if (!response.ok) throw new Error('Country manifest unavailable.');
  const manifest = await response.json();
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.countries)) throw new Error('Invalid country manifest.');
  const codes = new Set();
  for (const entry of manifest.countries) {
    if (!/^[A-Z]{2}$/.test(entry.code || '') || codes.has(entry.code) || !entry.name || !entry.instrument || !['available', 'planned'].includes(entry.status)) {
      throw new Error('Invalid country manifest entry.');
    }
    codes.add(entry.code);
  }
  return manifest;
}

export async function loadCountrySnapshot(entry) {
  if (!entry || entry.status !== 'available' || !/^[A-Z]{2}$/.test(entry.code || '')) throw new Error('Country release unavailable.');
  if (entry.code === 'IN' && !entry.snapshot) {
    const bundled = validateCountrySnapshot(indiaCountrySnapshot(), 'IN');
    if (entry.releaseId && entry.releaseId !== bundled.releaseId) throw new Error('Country release identity mismatch.');
    if (entry.coverageFrom && entry.coverageFrom !== bundled.coverage.from) throw new Error('Country release coverage mismatch.');
    if (entry.coverageThrough && entry.coverageThrough !== bundled.coverage.through) throw new Error('Country release coverage mismatch.');
    return bundled;
  }
  const expectedPath = new RegExp(`^countries/${entry.code.toLowerCase()}/[a-f0-9]{64}\\.json$`);
  if (!expectedPath.test(entry.snapshot || '') || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) throw new Error('Country release unavailable.');
  const response = await fetch(`/data/${entry.snapshot}`);
  if (!response.ok) throw new Error('Country release unavailable.');
  const bytes = await response.arrayBuffer();
  if (!globalThis.crypto?.subtle) throw new Error('Browser cannot verify the country release.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hex !== entry.sha256) throw new Error('Country release checksum mismatch.');
  const countrySnapshot = validateCountrySnapshot(JSON.parse(new TextDecoder().decode(bytes)), entry.code);
  if (entry.releaseId && countrySnapshot.releaseId && entry.releaseId !== countrySnapshot.releaseId) throw new Error('Country release identity mismatch.');
  if (entry.coverageFrom && entry.coverageFrom !== countrySnapshot.coverage.from) throw new Error('Country release coverage mismatch.');
  if (entry.coverageThrough && entry.coverageThrough !== countrySnapshot.coverage.through) throw new Error('Country release coverage mismatch.');
  return countrySnapshot;
}
