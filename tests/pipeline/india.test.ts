import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMpcResolution } from '../../pipeline/countries/in/resolution.ts';
import { projectIndia } from '../../pipeline/countries/in/project.ts';
import { validateRelease } from '../../schema/invariants.ts';
import { releaseHash } from '../../schema/hash.ts';
import { COUNTRIES, loadCalendar } from '../../pipeline/countries/registry.ts';
import { SourceParseError } from '../../pipeline/lib/errors.ts';

const res = (prid: string) => readFileSync(new URL(`../fixtures/rbi/mpc/${prid}.htm`, import.meta.url), 'utf8');
const url = (prid: string) => `https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=${prid}`;
const snapshot = () => JSON.parse(readFileSync(new URL('../../data/legacy/in/snapshot.json', import.meta.url), 'utf8'));
const bundled = () => readFileSync(new URL('../../data/legacy/in/releaseMeta.js', import.meta.url), 'utf8');
const ctx = () => {
  const meta = bundled();
  return {
    v2ReleaseId: /"releaseId":\s*"([^"]+)"/.exec(meta)![1],
    v2Sha256: /"artifactSha256":\s*"([^"]+)"/.exec(meta)![1],
    now: '2026-10-07T12:00:00Z',
  };
};

test('the Oct 2016 resolution (first MPC) is a cut to 6.25% with six votes in favour', () => {
  const r = parseMpcResolution(res('38224'), url('38224'));
  assert.equal(r.date, '2016-10-04');
  assert.equal(r.rateBps, 625);
  assert.equal(r.direction, 'cut');
  assert.deepEqual(r.vote, { for: 6, against: 0, dissents: [] });
});

test('the May 2020 off-cycle resolution is a cut to 4.00% with one member voting for a smaller cut', () => {
  const r = parseMpcResolution(res('49843'), url('49843'));
  assert.equal(r.date, '2020-05-22');
  assert.equal(r.rateBps, 400);
  assert.equal(r.direction, 'cut');
  assert.deepEqual(r.vote, { for: 5, against: 1, dissents: ['Dr. Chetan Ghate'] });
});

test('the Feb 2023 resolution is a 4 to 2 hike to 6.50% with named dissents', () => {
  const r = parseMpcResolution(res('55178'), url('55178'));
  assert.equal(r.date, '2023-02-08');
  assert.equal(r.rateBps, 650);
  assert.equal(r.direction, 'hike');
  assert.deepEqual(r.vote, { for: 4, against: 2, dissents: ['Dr. Ashima Goyal', 'Prof. Jayanth R. Varma'] });
});

test('the Feb 2026 resolution is a unanimous hold at 5.25%', () => {
  const r = parseMpcResolution(res('62169'), url('62169'));
  assert.equal(r.date, '2026-02-06');
  assert.equal(r.rateBps, 525);
  assert.equal(r.direction, 'hold');
  assert.deepEqual(r.vote, { for: 6, against: 0, dissents: [] });
  assert.match(r.excerpt, /unchanged at 5\.25 per cent/);
});

test('the Aug 2025 resolution ("maintain ... at 5.50 per cent") is a unanimous hold', () => {
  const r = parseMpcResolution(res('60957'), url('60957'));
  assert.equal(r.date, '2025-08-06');
  assert.equal(r.rateBps, 550);
  assert.equal(r.direction, 'hold');
  assert.deepEqual(r.vote, { for: 6, against: 0, dissents: [] });
});

test('a vote that does not add up to the six MPC members is not recorded', () => {
  const r = parseMpcResolution(res('46235'), url('46235'));
  assert.equal(r.rateBps, 625);
  assert.equal(r.direction, 'cut');
  assert.equal(r.vote, null);
});

test('a page without a policy repo rate decision throws SourceParseError', () => {
  assert.throws(() => parseMpcResolution(res('62169').replaceAll('policy repo rate', 'policy stance'), url('62169')), SourceParseError);
});

test('projectIndia produces a valid release from the bundled v2 snapshot', () => {
  const release = projectIndia(snapshot(), ctx());
  assert.deepEqual(validateRelease(release, undefined, [...COUNTRIES.IN.allowlist, 'rbidocs.rbi.org.in']), []);
});

test('the 7 Oct 2026 decision projects to a 25 bp statement-backed hike to 5.50%', () => {
  const d = projectIndia(snapshot(), ctx()).decisions.find(x => x.id === 'IN-2026-10-07');
  assert.equal(d?.direction, 'hike');
  assert.equal(d?.changeBps, 25);
  assert.deepEqual(d?.level, { kind: 'point', bps: 550 });
  assert.equal(d?.evidence, 'statement');
  assert.equal(d?.stance, 'calibrated tightening');
});

test('decisions are statement-backed only; Reuters observations stay secondary series points', () => {
  const release = projectIndia(snapshot(), ctx());
  assert.ok(release.decisions.every(d => d.evidence === 'statement'));
  const reutersSources = new Set(release.sources.filter(s => !s.official).map(s => s.id));
  assert.ok(release.series.some(p => reutersSources.has(p.sourceId) && p.evidence === 'secondary'));
});

test('the MPC ledger is complete from 4 Oct 2016 and the auction era is an observation era', () => {
  const release = projectIndia(snapshot(), ctx());
  assert.equal(release.coverage.ledgerFrom, '2016-10-04');
  const held = release.calendar.filter(m => m.status === 'held' && m.date >= '2016-10-04');
  assert.ok(held.length >= 58);
  assert.equal(release.eras.find(e => e.id === 'in-auction')?.basis, 'observation');
  assert.ok(loadCalendar('IN').some(m => m.id === 'IN-2016-12-07'));
});

test('upstream identifies the bundled v2 artifact, and projection is deterministic', () => {
  const a = projectIndia(snapshot(), ctx());
  const b = projectIndia(snapshot(), ctx());
  assert.equal(a.release.upstream?.sha256, ctx().v2Sha256);
  assert.equal(releaseHash(a), releaseHash(b));
});

test('an unknown v2 source type fails the projection', () => {
  const v2 = snapshot();
  v2.sources[0].type = 'mystery';
  assert.throws(() => projectIndia(v2, ctx()), SourceParseError);
});

test('resolution excerpts are the decision clause, never page navigation', () => {
  for (const prid of ['38224', '49843', '55178', '60957', '62169']) {
    const { excerpt } = parseMpcResolution(res(prid), url(prid));
    assert.ok(excerpt.length <= 400, `${prid}: ${excerpt.length} chars`);
    assert.doesNotMatch(excerpt, /Skip to main content|About Us|हिंदी/, prid);
    assert.match(excerpt, /policy repo rate/, prid);
  }
  assert.match(parseMpcResolution(res('38224'), url('38224')).excerpt, /^The Monetary Policy Committee \(MPC\) decided to/);
});

test('projected v2 sources carry no volatile retrieval metadata', () => {
  const release = projectIndia(snapshot(), ctx());
  const v2Ids = new Set(snapshot().sources.map((s: { id: string }) => s.id));
  for (const s of release.sources.filter(s => v2Ids.has(s.id))) {
    assert.equal(s.retrievedAt, null, s.id);
    assert.equal(s.sha256, null, s.id);
  }
});

test('the Aug 2019 resolution splits four to two on the size of the cut despite "unanimously voted to reduce"', () => {
  const r = parseMpcResolution(res('47818'), url('47818'));
  assert.equal(r.rateBps, 540);
  assert.deepEqual(r.vote, { for: 4, against: 2, dissents: ['Dr. Chetan Ghate', 'Dr. Pami Dua'] });
});
