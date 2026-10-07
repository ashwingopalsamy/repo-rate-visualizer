/* Daily rollup: Analytics Engine keeps events for three months, so once a day yesterday's totals are copied into D1,
   where they are kept. Idempotent: re-running a day overwrites that day's rows. Needs DB, CF_ACCOUNT_ID and
   CF_ANALYTICS_READ_TOKEN (an Account Analytics read token); without them it logs and does nothing. */
import type { Env } from './events.ts';
import { DATASET } from '../../src/analytics/schema.ts';

type Row = { event: string; route: string; cc: string; country: string; count: string | number; visitors: string | number };

const dayAfter = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);

/** Two queries for one UTC day: totals per event, route, country shown and visitor country; and the day's uniques. */
export function rollupQueries(day: string): [string, string] {
  const where = `timestamp >= toDateTime('${day} 00:00:00') AND timestamp < toDateTime('${dayAfter(day)} 00:00:00')`;
  return [
    `SELECT blob1 AS event, blob2 AS route, blob3 AS cc, blob6 AS country, SUM(_sample_interval) AS count, count(DISTINCT blob7) AS visitors FROM ${DATASET} WHERE ${where} GROUP BY event, route, cc, country FORMAT JSON`,
    `SELECT '_all' AS event, '' AS route, '' AS cc, '' AS country, SUM(_sample_interval) AS count, count(DISTINCT blob7) AS visitors FROM ${DATASET} WHERE ${where} FORMAT JSON`,
  ];
}

export function upsertStatements(day: string, rows: Row[]): { sql: string; params: (string | number)[] }[] {
  const sql = 'INSERT INTO daily (date, event, route, cc, country, count, visitors) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(date, event, route, cc, country) DO UPDATE SET count = excluded.count, visitors = excluded.visitors';
  return rows.map(r => ({ sql, params: [day, r.event, r.route, r.cc, r.country, Number(r.count), Number(r.visitors)] }));
}

async function query(env: Env, sql: string): Promise<Row[]> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`, {
    method: 'POST', headers: { authorization: `Bearer ${env.CF_ANALYTICS_READ_TOKEN}` }, body: sql,
  });
  if (!res.ok) throw new Error(`analytics engine sql: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { data: Row[] }).data;
}

/** Rolls up the UTC day before `now`. */
export async function rollup(env: Env, now: Date): Promise<void> {
  if (!env.DB || !env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_READ_TOKEN) { console.log('rollup skipped: DB, CF_ACCOUNT_ID or CF_ANALYTICS_READ_TOKEN not configured'); return; }
  const day = new Date(now.getTime() - 864e5).toISOString().slice(0, 10);
  const rows = (await Promise.all(rollupQueries(day).map(q => query(env, q)))).flat();
  const db = env.DB;
  await db.batch(upsertStatements(day, rows).map(s => db.prepare(s.sql).bind(...s.params)));
  console.log(`rollup ${day}: ${rows.length} rows`);
}
