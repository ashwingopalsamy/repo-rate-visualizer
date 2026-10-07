import test from 'node:test';
import assert from 'node:assert/strict';
import { syncIssues } from '../../pipeline/issues.ts';
import type { GhClient, OpenIssue } from '../../pipeline/issues.ts';
import type { CountryStatus } from '../../pipeline/run.ts';

function fakeGh(open: OpenIssue[] = []) {
  const calls: string[] = [];
  let next = 100;
  const gh: GhClient = {
    listOpen: () => open,
    create: (title, body) => { calls.push(`create ${title}`); open.push({ number: next++, title, body }); },
    edit: (number, body) => { calls.push(`edit ${number}`); const i = open.find(x => x.number === number); if (i) i.body = body; },
    close: number => { calls.push(`close ${number}`); open.splice(open.findIndex(x => x.number === number), 1); },
  };
  return { gh, calls, open };
}
const failed: CountryStatus = { code: 'US', ok: false, statuses: [], error: 'SourceParseError: Fed page changed' };
const healthy: CountryStatus = { code: 'US', ok: true, statuses: [{ meetingId: 'US-2026-09-16', state: 'verified' }] };
const announce = () => '2026-09-16T14:00:00-04:00';

test('a failing country with no open issue creates exactly one issue', () => {
  const { gh, calls } = fakeGh();
  syncIssues([failed], gh, '2026-09-16T20:00:00Z', announce);
  assert.deepEqual(calls, ['create Pipeline: US source failure']);
});

test('a repeated failure edits the open issue instead of opening another', () => {
  const { gh, calls } = fakeGh([{ number: 7, title: 'Pipeline: US source failure', body: 'old' }]);
  syncIssues([failed], gh, '2026-09-16T21:00:00Z', announce);
  assert.deepEqual(calls, ['edit 7']);
});

test('recovery closes the failure issue', () => {
  const { gh, calls } = fakeGh([{ number: 7, title: 'Pipeline: US source failure', body: 'old' }]);
  syncIssues([healthy], gh, '2026-09-16T22:00:00Z', announce);
  assert.deepEqual(calls, ['close 7']);
});

test('a decision pending more than six hours after its announcement opens the pending issue', () => {
  const { gh, calls } = fakeGh();
  const pending: CountryStatus = { code: 'US', ok: true, statuses: [{ meetingId: 'US-2026-09-16', state: 'pending' }] };
  syncIssues([pending], gh, '2026-09-16T23:59:00Z', announce);
  assert.deepEqual(calls, []);
  syncIssues([pending], gh, '2026-09-17T00:01:00Z', announce);
  assert.deepEqual(calls, ['create Pipeline: US decision pending over 6 hours']);
});
