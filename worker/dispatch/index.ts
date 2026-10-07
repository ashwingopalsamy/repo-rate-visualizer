import { dueDispatches } from './plan.ts';
import type { ScheduleFile } from '../../schema/files.ts';

export interface Env { GITHUB_DISPATCH_TOKEN: string }

const REPO = 'ashwingopalsamy/repo-rate-visualizer';
const SCHEDULE_URL = `https://raw.githubusercontent.com/${REPO}/main/data/schedule.json`;
const DISPATCH_URL = `https://api.github.com/repos/${REPO}/actions/workflows/refresh.yml/dispatches`;
const SWEEP_CRON = '17 6 * * *';

async function dispatch(env: Env, inputs: { countries: string; reason: string }): Promise<void> {
  const response = await fetch(DISPATCH_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'policy-rate-atlas-dispatch',
    },
    body: JSON.stringify({ ref: 'main', inputs }),
  });
  if (!response.ok) throw new Error(`workflow_dispatch failed: HTTP ${response.status} ${await response.text()}`);
}

export default {
  /** Every 10 minutes: dispatch a refresh for meetings on the retry ladder. Daily at 06:17 UTC: sweep every country. */
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    if (controller.cron === SWEEP_CRON) {
      await dispatch(env, { countries: 'ALL', reason: 'sweep' });
      return;
    }
    const response = await fetch(SCHEDULE_URL, { headers: { 'user-agent': 'policy-rate-atlas-dispatch' } });
    if (!response.ok) throw new Error(`schedule.json unavailable: HTTP ${response.status}`);
    const due = dueDispatches(await response.json() as ScheduleFile, new Date(controller.scheduledTime).toISOString());
    if (due) await dispatch(env, { countries: due.countries.join(','), reason: due.reason });
  },
} satisfies ExportedHandler<Env>;
