import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, loadCalendar, loadSources, loadTransmission } from '../../pipeline/countries/registry.ts';

const hostAllowed = (url: string, allowlist: string[]) => {
  const host = new URL(url).hostname;
  return allowlist.some(d => host === d || host.endsWith(`.${d}`));
};

for (const code of ['IN', 'US'] as const) {
  test(`${code} calendar ids are unique and follow CC-YYYY-MM-DD`, () => {
    const meetings = loadCalendar(code);
    assert.ok(meetings.length > 0);
    assert.equal(new Set(meetings.map(m => m.id)).size, meetings.length);
    for (const m of meetings) assert.equal(m.id, `${code}-${m.date}`);
  });

  test(`${code} calendar and transmission cite allowlisted official sources`, () => {
    const sources = new Map(loadSources(code).map(s => [s.id, s]));
    const cited = [...loadCalendar(code).map(m => m.sourceId), ...loadTransmission(code).map(t => t.sourceId)];
    for (const id of cited) {
      const source = sources.get(id);
      assert.ok(source, `missing source ${id}`);
      assert.ok(hostAllowed(source.url, COUNTRIES[code].allowlist), `${source.url} not allowlisted`);
    }
  });

  test(`${code} has at least two meetings after 2026-10-07`, () => {
    assert.ok(loadCalendar(code).filter(m => m.date > '2026-10-07').length >= 2);
  });
}

test('US announceAt is 2pm New York time with the date-correct offset', () => {
  const m = loadCalendar('US').find(x => x.id === 'US-2026-09-16');
  assert.equal(m?.announceAt, '2026-09-16T14:00:00-04:00');
  assert.equal(loadCalendar('US').find(x => x.id === 'US-2026-01-28')?.announceAt, '2026-01-28T14:00:00-05:00');
});

test('IN announceAt is 10am IST and the FY2026-27 schedule is complete', () => {
  const ids = loadCalendar('IN').map(m => m.id);
  for (const id of ['IN-2026-04-08', 'IN-2026-06-05', 'IN-2026-08-05', 'IN-2026-10-07', 'IN-2026-12-04', 'IN-2027-02-05']) assert.ok(ids.includes(id), id);
  assert.equal(loadCalendar('IN').find(m => m.id === 'IN-2026-12-04')?.announceAt, '2026-12-04T10:00:00+05:30');
});
