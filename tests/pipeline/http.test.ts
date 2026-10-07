import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchText, USER_AGENT } from '../../pipeline/lib/http.ts';

const reply = (status: number, body: string) => new Response(body, { status, headers: { 'content-type': 'text/plain' } });

test('fetchText sends the pipeline user-agent', async () => {
  let seen: string | null = null;
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    seen = new Headers(init?.headers).get('user-agent');
    return reply(200, 'ok');
  }) as typeof fetch;
  await fetchText('https://example.org/x', { fetchImpl });
  assert.equal(seen, 'PolicyRateAtlas/2.0 (+https://github.com/ashwingopalsamy/repo-rate-visualizer)');
  assert.equal(USER_AGENT, seen);
});

test('fetchText retries a 503 and returns the following 200 body', async () => {
  let calls = 0;
  const fetchImpl = (async () => (++calls === 1 ? reply(503, 'busy') : reply(200, 'fresh'))) as typeof fetch;
  const result = await fetchText('https://example.org/x', { fetchImpl, retries: 2 });
  assert.equal(result.body, 'fresh');
  assert.equal(result.status, 200);
  assert.equal(calls, 2);
});

test('fetchText rejects a 404 without retrying', async () => {
  let calls = 0;
  const fetchImpl = (async () => { calls++; return reply(404, 'missing'); }) as typeof fetch;
  await assert.rejects(fetchText('https://example.org/x', { fetchImpl, retries: 2 }), /404/);
  assert.equal(calls, 1);
});
