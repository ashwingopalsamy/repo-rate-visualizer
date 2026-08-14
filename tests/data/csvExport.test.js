import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionCsv } from '../../src/data/csvExport.js';

const source = {
  id: 'source-rbi',
  type: 'policy-resolution',
  title: 'RBI MPC Resolution',
  url: 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=1',
};

const decisions = [
  {
    id: 'decision-hold',
    date: '2026-08-05',
    dateObj: new Date('2026-08-05T00:00:00.000Z'),
    repoRate: 5.25,
    action: 'hold',
    changeBps: 0,
    stance: 'neutral',
    summary: 'Rate held, source text includes a comma, safely quoted.',
    sourceIds: ['source-rbi'],
  },
];

test('exports canonical holds with source provenance', () => {
  const csv = buildDecisionCsv({
    decisions,
    sources: [source],
    macroEvents: [],
    regimes: [],
    dateRange: { start: null, end: null },
  });

  const lines = csv.split('\n');
  assert.match(lines[0], /Decision ID/);
  assert.match(lines[0], /Action/);
  assert.match(lines[0], /Stance/);
  assert.match(lines[0], /Source Title\(s\)/);
  assert.match(lines[0], /Source URL\(s\)/);
  assert.match(lines[1], /"decision-hold"/);
  assert.match(lines[1], /"hold"/);
  assert.match(lines[1], /"neutral"/);
  assert.match(lines[1], /"RBI MPC Resolution"/);
  assert.match(lines[1], /https:\/\/www\.rbi\.org\.in\/Scripts\/BS_PressReleaseDisplay\.aspx\?prid=1/);
  assert.match(lines[1], /"Rate held, source text includes a comma, safely quoted\."/);
});
