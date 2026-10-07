/* POST /e: the first-party event collector. Accepts small same-origin sendBeacon batches of allowlisted events, drops
   bots, and writes one Analytics Engine data point per event. The IP address and user agent are used only to derive a
   daily visitor id (keyed HMAC, truncated) and are never written. Responses never echo input. */
import { z } from 'zod';
import { EVENTS, MAX_BYTES, MAX_EVENTS } from '../../src/analytics/schema.ts';

export interface Env {
  ASSETS: Fetcher;
  EVENTS?: AnalyticsEngineDataset;
  ANALYTICS_SALT_KEY?: string;
  DB?: D1Database;
  CF_ACCOUNT_ID?: string;
  CF_ANALYTICS_READ_TOKEN?: string;
}

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|chrome-lighthouse|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl|wget|python|httpclient|axios|node-fetch|undici|go-http|java\/|okhttp|monitor|uptime|pingdom|phantom|selenium|puppeteer|playwright/i;

const event = z.union(Object.entries(EVENTS).map(([n, props]) => z.strictObject({
  n: z.literal(n),
  p: z.strictObject(Object.fromEntries(Object.entries(props).map(([k, values]) => [k, z.enum(values as readonly [string, ...string[]]).optional()]))),
})) as unknown as [z.ZodType, z.ZodType, ...z.ZodType[]]);
const batch = z.strictObject({ v: z.literal(1), path: z.string().max(64).regex(/^\/[a-z0-9/-]*$/), e: z.array(event).min(1).max(MAX_EVENTS) });
type Event = { n: keyof typeof EVENTS; p: Record<string, string | undefined> };

const empty = (status: number, extra: Record<string, string> = {}) => new Response(null, { status, headers: { 'cache-control': 'no-store', ...extra } });

/** Reads at most `limit` bytes; returns null when the body is larger, without reading the rest. */
async function readLimited(req: Request, limit: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > limit) return null;
  if (!req.body) return '';
  const reader = req.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(size); let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  return new TextDecoder().decode(all);
}

/** A daily visitor id: HMAC-SHA256(key, date|ip|ua), first 16 hex characters. Not reversible without the key, and
 *  different every UTC day, so it counts uniques per day and cannot link one day's visits to another's. */
export async function visitorId(key: string, date: string, ip: string, ua: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${date}|${ip}|${ua}`)));
  return Array.from(mac.slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
}

/** Blob layout: [event, route, cc, a, b, visitor country, visitor id]. `cc` is the country shown (or switched from);
 *  `a` and `b` are the event's remaining properties in allowlist order. */
function dataPoint(e: Event, country: string, visitor: string): AnalyticsEngineDataPoint {
  const p = e.p, rest = Object.keys(EVENTS[e.n]).filter(k => k !== 'route' && k !== 'cc' && k !== 'from').map(k => p[k] ?? '');
  return { indexes: [e.n], blobs: [e.n, p.route ?? '', p.cc ?? p.from ?? '', rest[0] ?? '', rest[1] ?? '', country, visitor], doubles: [1] };
}

export async function handleEvents(req: Request, env: Env, now = new Date()): Promise<Response> {
  if (req.method !== 'POST') return empty(405, { allow: 'POST' });
  const origin = req.headers.get('origin'), host = new URL(req.url).host;
  if ((origin && new URL(origin).host !== host) || req.headers.get('sec-fetch-site') === 'cross-site') return empty(403);
  const text = await readLimited(req, MAX_BYTES);
  if (text == null) return empty(413);
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return empty(400); }
  const ok = batch.safeParse(parsed);
  if (!ok.success) return empty(400);
  const ua = req.headers.get('user-agent') ?? '';
  if (!ua || BOT.test(ua) || !env.EVENTS) return empty(204);
  const ip = req.headers.get('cf-connecting-ip') ?? '';
  const visitor = env.ANALYTICS_SALT_KEY && ip ? await visitorId(env.ANALYTICS_SALT_KEY, now.toISOString().slice(0, 10), ip, ua) : '';
  const country = (req as Request & { cf?: { country?: string } }).cf?.country ?? '';
  for (const e of ok.data.e as Event[]) env.EVENTS.writeDataPoint(dataPoint(e, country, visitor));
  return empty(204);
}
