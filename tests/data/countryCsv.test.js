import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCountryCsv } from '../../src/data/countryCsv.js';

function model(code, records) {
  return {
    code,
    name: code === 'US' ? 'United States' : 'Exampleland',
    centralBank: 'Central bank',
    instrument: 'Policy rate',
    records,
    sources: [],
    release: {},
  };
}

const change = (overrides = {}) => ({
  id: 'record-1',
  recordType: 'policy_change',
  recordDate: '2025-01-29',
  decisionDate: null,
  effectiveDate: null,
  value: { kind: 'range', lowBps: 375, highBps: 400 },
  changeBps: 25,
  sourceIds: [],
  ...overrides,
});

test('country CSV preserves published-change wording and range endpoints', () => {
  const csv = buildCountryCsv(model('US', [change()]));
  const [header, row] = csv.split('\n');
  assert.match(header, /"Published date"/);
  assert.match(header, /"Published change \(bps\)"/);
  assert.match(row, /"range","375","400","hike","25"/);
});

test('country CSV uses record wording when snapshots include observations', () => {
  const observation = change({ id: 'record-2', recordType: 'rate_observation', changeBps: undefined });
  const header = buildCountryCsv(model('XX', [change(), observation])).split('\n')[0];
  assert.match(header, /"Record date"/);
  assert.match(header, /"Change \(bps\)"/);
});
