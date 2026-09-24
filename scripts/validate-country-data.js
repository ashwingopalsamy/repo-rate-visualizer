import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { validateCountrySnapshot, indiaCountrySnapshot } from '../src/data/countrySnapshot.js';

const manifest = JSON.parse(readFileSync(new URL('../public/data/countries/manifest.json', import.meta.url)));
assert.equal(manifest.schemaVersion, 1);
const india = manifest.countries.find(country => country.code === 'IN');
const us = manifest.countries.find(country => country.code === 'US');
assert.equal(india.status, 'available');
assert.equal(us.status, 'available');
assert.match(us.snapshot, /^countries\/us\/[a-f0-9]{64}\.json$/);

const bytes = readFileSync(new URL(`../public/data/${us.snapshot}`, import.meta.url));
const digest = createHash('sha256').update(bytes).digest('hex');
assert.equal(digest, us.sha256);
assert.equal(us.releaseId, `us-${digest}`);
const snapshot = validateCountrySnapshot(JSON.parse(bytes), 'US');
assert.equal(snapshot.coverage.from, snapshot.records[0].recordDate);
assert.equal(snapshot.coverage.through, snapshot.records.at(-1).recordDate);
assert.equal(us.coverageThrough, snapshot.coverage.through);
assert(snapshot.records.some(record => record.value.kind === 'range'));
assert(snapshot.records.some(record => record.value.kind === 'point'));
assert(snapshot.records.every(record => record.recordType === 'policy_change'));

const indiaSnapshot = validateCountrySnapshot(indiaCountrySnapshot(), 'IN');
assert.equal(india.coverageFrom, indiaSnapshot.coverage.from);
assert.equal(india.coverageThrough, indiaSnapshot.coverage.through);
assert.equal(india.releaseId, indiaSnapshot.releaseId);
console.log(`Validated ${snapshot.records.length} US changes and ${indiaSnapshot.records.length} India records.`);
