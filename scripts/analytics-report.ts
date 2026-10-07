/**
 * Prints a traffic and product report from Analytics Engine for the last 7, 30 and 90 days, as Markdown.
 * Usage: CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_ANALYTICS_TOKEN=… npm run analytics:report [-- --days 7,30,90]
 * The token needs Account Analytics: Read. Counts use SUM(_sample_interval), so they stay correct under sampling.
 * Visitor ids rotate daily, so "visitor-days" counts each visitor once per day they came back.
 */
import { DATASET } from '../src/analytics/schema.ts';

type Row = Record<string, string | number>;
const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_ANALYTICS_TOKEN;

async function sql(q: string): Promise<Row[]> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: `${q} FORMAT JSON` });
  if (!res.ok) throw new Error(`Analytics Engine SQL: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { data: Row[] }).data;
}
const table = (head: string[], rows: (string | number)[][]) => rows.length ? [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n') : '_No data._';
const n = (v: string | number) => Math.round(Number(v)).toLocaleString('en-GB');

async function report(days: number): Promise<string> {
  const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;
  const [totals] = await sql(`SELECT SUM(if(blob1 = 'page', _sample_interval, 0)) AS views, SUM(_sample_interval) AS events FROM ${DATASET} WHERE ${since}`);
  const daily = await sql(`SELECT toStartOfDay(timestamp) AS day, count(DISTINCT blob7) AS visitors FROM ${DATASET} WHERE ${since} GROUP BY day ORDER BY day`);
  const countries = await sql(`SELECT blob6 AS country, SUM(_sample_interval) AS views FROM ${DATASET} WHERE ${since} AND blob1 = 'page' GROUP BY country ORDER BY views DESC LIMIT 10`);
  const routes = await sql(`SELECT blob2 AS route, blob3 AS cc, SUM(_sample_interval) AS views FROM ${DATASET} WHERE ${since} AND blob1 = 'page' GROUP BY route, cc ORDER BY views DESC LIMIT 12`);
  const switches = await sql(`SELECT blob3 AS from_cc, blob4 AS to_cc, blob5 AS via, SUM(_sample_interval) AS n FROM ${DATASET} WHERE ${since} AND blob1 = 'country_switch' GROUP BY from_cc, to_cc, via ORDER BY n DESC LIMIT 15`);
  const events = await sql(`SELECT blob1 AS event, blob3 AS cc, SUM(_sample_interval) AS n FROM ${DATASET} WHERE ${since} AND blob1 != 'page' GROUP BY event, cc ORDER BY event, n DESC`);
  const visitorDays = daily.reduce((s, r) => s + Number(r.visitors), 0);
  return [
    `## Last ${days} days`,
    `**${n(totals?.views ?? 0)}** page views · **${n(visitorDays)}** visitor-days (about **${n(visitorDays / Math.max(1, daily.length))}** a day) · ${n(totals?.events ?? 0)} events`,
    '### Visitor countries', table(['Country', 'Views'], countries.map(r => [r.country || 'unknown', n(r.views)])),
    '### Pages', table(['Page', 'Country', 'Views'], routes.map(r => [r.route, r.cc || '—', n(r.views)])),
    '### Country switches', table(['From', 'To', 'Via', 'Count'], switches.map(r => [r.from_cc, r.to_cc, r.via, n(r.n)])),
    '### Product events', table(['Event', 'Country', 'Count'], events.map(r => [r.event, r.cc || '—', n(r.n)])),
  ].join('\n\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!account || !token) { console.error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_ANALYTICS_TOKEN (Account Analytics: Read).'); process.exit(1); }
  const i = process.argv.indexOf('--days'), spans = (i > 0 ? process.argv[i + 1] : '7,30,90').split(',').map(Number).filter(d => d > 0 && d <= 92);
  const parts = [];
  for (const d of spans) parts.push(await report(d));
  console.log(`# Policy Rate Atlas: traffic\n\nPage traffic from Cloudflare Web Analytics is in the dashboard; this covers first-party events.\n\n${parts.join('\n\n')}`);
}
