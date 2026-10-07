/**
 * One-off D2 backfill: fetch every curated MPC resolution, parse it, and write
 *   - pipeline/countries/in/mpc-decisions.json (statement-backed MPC ledger, Oct 2016 to Feb 2026)
 *   - historical meetings into pipeline/calendars/in.json
 * India's v2 snapshots and the Hugging Face dataset are not touched.
 * Usage: node pipeline/countries/in/backfill.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchText } from '../../lib/http.ts';
import { parseMpcResolution } from './resolution.ts';
import type { MpcResolution } from './resolution.ts';

type Curated = { offCycle: string[]; resolutions: { prid: string; url: string; title: string }[] };
export type LedgerEntry = MpcResolution & { prid: string; title: string; offCycle: boolean };

const here = (path: string) => new URL(path, import.meta.url);
const curated = JSON.parse(readFileSync(here('./backfill.json'), 'utf8')) as Curated;

export async function buildLedger(fetchImpl?: typeof fetch): Promise<LedgerEntry[]> {
  const entries: LedgerEntry[] = [];
  for (const item of curated.resolutions) {
    const page = await fetchText(item.url, { fetchImpl });
    const parsed = parseMpcResolution(page.body, item.url);
    entries.push({ ...parsed, prid: item.prid, title: item.title, offCycle: curated.offCycle.includes(parsed.date) });
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ledger = await buildLedger();
  writeFileSync(here('./mpc-decisions.json'), `${JSON.stringify({ generatedBy: 'pipeline/countries/in/backfill.ts', entries: ledger }, null, 2)}\n`);
  const calendarPath = here('../../calendars/in.json');
  const calendar = JSON.parse(readFileSync(calendarPath, 'utf8'));
  const known = new Set(calendar.meetings.map((m: { id: string }) => m.id));
  const history = ledger.filter(e => !e.offCycle && !known.has(`IN-${e.date}`)).map(e => ({ id: `IN-${e.date}`, date: e.date, meetingStart: null, status: 'scheduled', sourceId: `in-mpc-${e.prid}` }));
  const historySources = ledger.filter(e => !e.offCycle).map(e => ({ id: `in-mpc-${e.prid}`, type: 'statement', title: e.title, url: e.url }));
  calendar.meetings = [...history, ...calendar.meetings].sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
  const sourceIds = new Set(calendar.sources.map((s: { id: string }) => s.id));
  calendar.sources = [...calendar.sources, ...historySources.filter(s => !sourceIds.has(s.id))];
  writeFileSync(calendarPath, `${JSON.stringify(calendar, null, 2)}\n`);
  console.log(`ledger ${ledger.length} resolutions; calendar now ${calendar.meetings.length} meetings; votes captured ${ledger.filter(e => e.vote).length}`);
}
