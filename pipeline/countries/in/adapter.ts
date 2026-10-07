import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCalendar } from '../registry.ts';
import { minutesBetween } from '../../lib/time.ts';
import type { CountryResult, MeetingStatus, RunContext } from '../../types.ts';
import { projectIndia } from './project.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Refreshes India through the existing v2 RBI fetcher (unchanged), then projects the bundled snapshot to v3. */
export async function runIndia(ctx: RunContext): Promise<CountryResult> {
  execFileSync(process.execPath, ['scripts/fetch-rbi-data.js'], { cwd: ROOT, stdio: 'inherit' });
  const snapshot = JSON.parse(readFileSync(`${ROOT}data/legacy/in/snapshot.json`, 'utf8'));
  const { bundledRelease } = await import(`${pathToFileURL(`${ROOT}data/legacy/in/releaseMeta.js`).href}?t=${Date.now()}`);
  const release = projectIndia(snapshot, { v2ReleaseId: bundledRelease.releaseId, v2Sha256: bundledRelease.artifactSha256, now: ctx.now });
  const decided = new Set(release.decisions.map(d => d.meetingId));
  const statuses: MeetingStatus[] = loadCalendar('IN')
    .filter(m => m.date >= (release.coverage.ledgerFrom ?? m.date) && minutesBetween(m.announceAt, ctx.now) >= 0)
    .map(m => ({ meetingId: m.id, state: decided.has(m.id) ? 'verified' : 'pending', ...(decided.has(m.id) ? {} : { detail: 'Resolution not published yet' }) }));
  return { release, statuses };
}
