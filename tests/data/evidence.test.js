import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEvidence, coverageSummary, isCountableHold } from '../../src/lib/evidence.js';

const sources = [
  { id: 'rbi', type: 'policy-resolution' },
  { id: 'reuters', type: 'historical-rate-series' },
];

test('classifies policy resolutions separately from historical observations', () => {
  const direct = classifyEvidence({ sourceIds: ['rbi'] }, sources);
  const historical = classifyEvidence({ sourceIds: ['reuters'] }, sources);

  assert.equal(direct.recordType, 'policy_decision');
  assert.equal(direct.evidenceStatus, 'primary-decision');
  assert.equal(historical.recordType, 'rate_observation');
  assert.equal(historical.evidenceStatus, 'historical-secondary');
});

test('does not count the initial observation as a hold', () => {
  assert.equal(isCountableHold({ action: 'hold' }), true);
  assert.equal(isCountableHold({ action: 'initial' }), false);
  assert.deepEqual(
    coverageSummary([
      { action: 'initial', sourceIds: ['reuters'] },
      { action: 'hold', sourceIds: ['rbi'] },
    ], sources),
    {
      totalRecords: 2,
      directDecisionRecords: 1,
      officialContextRecords: 0,
      historicalObservationRecords: 1,
      mixedRecords: 0,
    },
  );
});
