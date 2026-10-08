import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApi, csvCell, redirects } from '../../scripts/build-api.ts';

test('csvCell neutralises formula injection and quotes delimiters', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell('-25'), "'-25");
  assert.equal(csvCell('@SUM'), "'@SUM");
  assert.equal(csvCell(-25), '-25');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell(null), '');
});

test('buildApi writes every country, its CSVs and the immutable release', () => {
  const out = mkdtempSync(join(tmpdir(), 'atlas-api-'));
  const { files } = buildApi(out);
  const countries = JSON.parse(readFileSync(join(out, 'countries.json'), 'utf8')) as { countries: { cc: string; release: string }[] };
  assert.deepEqual(countries.countries.map(c => c.cc).sort(), ['AU', 'BR', 'CA', 'EA', 'GB', 'IN', 'US']);
  for (const c of countries.countries) {
    assert.ok(existsSync(join(out, 'countries', `${c.cc.toLowerCase()}.json`)));
    assert.ok(existsSync(join(out, 'countries', c.cc.toLowerCase(), 'decisions.csv')));
    assert.ok(existsSync(join(out, 'countries', c.cc.toLowerCase(), 'series.csv')));
    assert.ok(existsSync(join(out, 'releases', c.cc, `${c.release}.json`)));
  }
  const latest = JSON.parse(readFileSync(join(out, 'latest.json'), 'utf8')) as { countries: Record<string, { level: unknown; release: string }> };
  assert.deepEqual(latest.countries.IN.level, { kind: 'point', bps: 550 });
  const csv = readFileSync(join(out, 'countries', 'in', 'decisions.csv'), 'utf8').split('\n');
  assert.equal(csv[0], 'announced_at,effective_date,direction,change_bps,low_bps,high_bps,vote_for,vote_against,stance,statement_url,off_cycle');
  assert.ok(files > 20);
});

test('redirects keep v1 links working', () => {
  const r = redirects();
  assert.match(r, /^\/decision\/\* \/in\/ 302$/m);
  assert.match(r, /^\/countries \/world\/ 301$/m);
  assert.match(r, /^\/country\/us \/us\/ 301$/m);
});
