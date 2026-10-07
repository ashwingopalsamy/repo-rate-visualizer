/**
 * Keep one GitHub issue per country and failure class in sync with the latest run. Usage: node pipeline/issues.ts
 * With --deploy-mismatch, instead compare the live API's releases with data/manifest.json.
 * Issues are edited in place (never commented on) and closed automatically on recovery.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES, loadCalendar } from './countries/registry.ts';
import type { CountryCode } from './countries/registry.ts';
import { minutesBetween } from './lib/time.ts';
import type { CountryStatus } from './run.ts';
import type { Manifest } from '../schema/files.ts';

export type OpenIssue = { number: number; title: string; body: string };
export type GhClient = {
  listOpen(): OpenIssue[];
  create(title: string, body: string): void;
  edit(number: number, body: string): void;
  close(number: number): void;
};

const PENDING_LIMIT_MIN = 360;
export const failureTitle = (code: string) => `Pipeline: ${code} source failure`;
export const pendingTitle = (code: string) => `Pipeline: ${code} decision pending over 6 hours`;

function upsert(gh: GhClient, open: OpenIssue[], title: string, body: string, actions: string[]) {
  const existing = open.find(i => i.title === title);
  if (existing) { gh.edit(existing.number, body); actions.push(`edit ${existing.number}`); }
  else { gh.create(title, body); actions.push(`create ${title}`); }
}
function resolve(gh: GhClient, open: OpenIssue[], title: string, actions: string[]) {
  const existing = open.find(i => i.title === title);
  if (existing) { gh.close(existing.number); actions.push(`close ${existing.number}`); }
}

export function syncIssues(statuses: CountryStatus[], gh: GhClient, now: string, announceAtOf: (meetingId: string) => string | undefined): string[] {
  const open = gh.listOpen();
  const actions: string[] = [];
  for (const status of statuses) {
    if (!status.ok) {
      const detail = status.error ?? status.issues?.map(i => `- ${i.code}: ${i.message}`).join('\n') ?? 'Unknown failure';
      upsert(gh, open, failureTitle(status.code), `The ${status.code} refresh failed at ${now}; the last good release stays live.\n\n${detail}`, actions);
      continue;
    }
    resolve(gh, open, failureTitle(status.code), actions);
    const late = status.statuses.filter(s => {
      const at = s.state === 'pending' ? announceAtOf(s.meetingId) : undefined;
      return at !== undefined && minutesBetween(at, now) >= PENDING_LIMIT_MIN;
    });
    if (late.length) upsert(gh, open, pendingTitle(status.code), `Still pending at ${now}:\n\n${late.map(s => `- ${s.meetingId}: ${s.detail ?? 'pending'}`).join('\n')}`, actions);
    else resolve(gh, open, pendingTitle(status.code), actions);
  }
  return actions;
}

export const deployTitle = 'Pipeline: live site behind manifest';
export const LIVE_LATEST = 'https://rates.ashwingopalsamy.in/api/v1/latest.json';

/** Countries whose live release differs from the manifest (or is missing from the live site). */
export function liveBehind(manifest: Manifest, live: { countries: Record<string, { release: string } | undefined> }): string[] {
  return Object.entries(manifest.countries).filter(([cc, e]) => e.status === 'available' && live.countries[cc]?.release !== e.release).map(([cc]) => cc);
}
export function syncDeploy(behind: string[], gh: GhClient, now: string): string[] {
  const open = gh.listOpen(), actions: string[] = [];
  if (behind.length) upsert(gh, open, deployTitle, `At ${now} ${LIVE_LATEST} served older releases than data/manifest.json for ${behind.join(', ')}. Check the Cloudflare Workers build for main.`, actions);
  else resolve(gh, open, deployTitle, actions);
  return actions;
}

function cliGh(): GhClient {
  const gh = (args: string[]) => execFileSync('gh', args, { encoding: 'utf8' });
  try { gh(['label', 'create', 'pipeline', '--color', 'B60205', '--description', 'Data pipeline health', '--force']); } catch { /* label exists or no permission */ }
  return {
    listOpen: () => JSON.parse(gh(['issue', 'list', '--state', 'open', '--label', 'pipeline', '--json', 'number,title,body', '--limit', '100'])),
    create: (title, body) => { gh(['issue', 'create', '--title', title, '--body', body, '--label', 'pipeline']); },
    edit: (number, body) => { gh(['issue', 'edit', String(number), '--body', body]); },
    close: number => { gh(['issue', 'close', String(number), '--reason', 'completed']); },
  };
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--deploy-mismatch')) {
  const manifest = JSON.parse(readFileSync(new URL('../data/manifest.json', import.meta.url), 'utf8')) as Manifest;
  const res = await fetch(LIVE_LATEST, { headers: { 'cache-control': 'no-cache' } });
  const behind = res.ok ? liveBehind(manifest, await res.json() as { countries: Record<string, { release: string }> }) : Object.keys(manifest.countries);
  for (const action of syncDeploy(behind, cliGh(), new Date().toISOString())) console.log(action);
  console.log(behind.length ? `live site behind for ${behind.join(', ')}` : 'live site matches the manifest');
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const outDir = join(root, '.out');
  const statuses: CountryStatus[] = existsSync(outDir)
    ? readdirSync(outDir).filter(c => existsSync(join(outDir, c, 'status.json'))).map(c => JSON.parse(readFileSync(join(outDir, c, 'status.json'), 'utf8')))
    : [];
  const announce = new Map(Object.keys(COUNTRIES).flatMap(c => loadCalendar(c as CountryCode).map(m => [m.id, m.announceAt] as [string, string])));
  for (const action of syncIssues(statuses, cliGh(), new Date().toISOString(), id => announce.get(id))) console.log(action);
}
