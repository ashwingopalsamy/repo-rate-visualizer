import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleEvents, visitorId } from '../../worker/site/events.ts';
import type { Env } from '../../worker/site/events.ts';
import { rollupQueries, upsertStatements } from '../../worker/site/rollup.ts';

type Point = { indexes?: string[]; blobs?: (string | null)[]; doubles?: number[] };
const IP = '203.0.113.7', UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/131 Safari/537.36';
function env(points: Point[] = []): Env {
  return { ANALYTICS_SALT_KEY: 'test-key-not-a-secret', EVENTS: { writeDataPoint: (p: Point) => { points.push(p); } } } as unknown as Env;
}
const post = (body: unknown, headers: Record<string, string> = {}) => new Request('https://rates.ashwingopalsamy.in/e', {
  method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { 'content-type': 'application/json', 'user-agent': UA, 'cf-connecting-ip': IP, origin: 'https://rates.ashwingopalsamy.in', ...headers },
});
const batch = (e: unknown[]) => ({ v: 1, path: '/in/', e });

test('only POST is accepted', async () => {
  const res = await handleEvents(new Request('https://rates.ashwingopalsamy.in/e'), env());
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'POST');
});

test('bodies over 2 KB are rejected without parsing', async () => {
  const res = await handleEvents(post('x'.repeat(2049)), env());
  assert.equal(res.status, 413);
});

test('unknown events, unknown values and extra properties are rejected', async () => {
  for (const e of [[{ n: 'purchase', p: {} }], [{ n: 'page', p: { route: 'admin' } }], [{ n: 'country_switch', p: { from: 'IN', to: 'XX', via: 'link' } }], [{ n: 'loan_calc', p: { cc: 'IN', mode: 'since', amount: '5000000' } }], []]) {
    const points: Point[] = [];
    const res = await handleEvents(post(batch(e)), env(points));
    assert.equal(res.status, 400, JSON.stringify(e));
    assert.equal(points.length, 0);
  }
  assert.equal((await handleEvents(post('{not json'), env())).status, 400);
});

test('cross-site posts are refused', async () => {
  const res = await handleEvents(post(batch([{ n: 'page', p: { route: 'world' } }]), { origin: 'https://evil.example' }), env());
  assert.equal(res.status, 403);
});

test('bots are dropped silently', async () => {
  const points: Point[] = [];
  const res = await handleEvents(post(batch([{ n: 'page', p: { route: 'world' } }]), { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' }), env(points));
  assert.equal(res.status, 204);
  assert.equal(points.length, 0);
});

test('valid events are written with the allowlisted fields and no IP, UA or raw hash input', async () => {
  const points: Point[] = [];
  const res = await handleEvents(post(batch([{ n: 'page', p: { route: 'country', cc: 'IN' } }, { n: 'country_switch', p: { from: 'IN', to: 'US', via: 'palette' } }])), env(points));
  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');
  assert.equal(points.length, 2);
  assert.deepEqual(points[0].indexes, ['page']);
  assert.deepEqual(points[1].blobs!.slice(0, 5), ['country_switch', '', 'IN', 'US', 'palette']);
  assert.deepEqual(points[0].doubles, [1]);
  const visitor = points[0].blobs![6]!;
  assert.match(visitor, /^[0-9a-f]{16}$/);
  const all = JSON.stringify(points);
  for (const leak of [IP, UA, 'Mozilla', 'test-key-not-a-secret']) assert.ok(!all.includes(leak), `leaked ${leak}`);
});

test('the visitor id changes every day and cannot be recomputed without the key', async () => {
  const a = await visitorId('k', '2026-10-07', IP, UA), b = await visitorId('k', '2026-10-08', IP, UA), c = await visitorId('other', '2026-10-07', IP, UA);
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.equal(a, await visitorId('k', '2026-10-07', IP, UA));
});

test('the rollup queries one UTC day and upserts idempotently', () => {
  const [byGroup, total] = rollupQueries('2026-10-06');
  assert.match(byGroup, /timestamp >= toDateTime\('2026-10-06 00:00:00'\) AND timestamp < toDateTime\('2026-10-07 00:00:00'\)/);
  assert.match(byGroup, /SUM\(_sample_interval\)/);
  assert.match(total, /count\(DISTINCT blob7\)/);
  const stmts = upsertStatements('2026-10-06', [{ event: 'page', route: 'country', cc: 'IN', country: 'IN', count: '12', visitors: '9' }]);
  assert.equal(stmts.length, 1);
  assert.match(stmts[0].sql, /ON CONFLICT\(date, event, route, cc, country\) DO UPDATE/);
  assert.deepEqual(stmts[0].params, ['2026-10-06', 'page', 'country', 'IN', 'IN', 12, 9]);
});
