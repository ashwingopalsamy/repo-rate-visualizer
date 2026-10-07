/* The site Worker. Static assets (every page, the API, flags) are served by Workers static assets without invoking
   this code; only /e runs here (assets.run_worker_first). The daily cron rolls analytics up into D1. */
import { handleEvents } from './events.ts';
import type { Env } from './events.ts';
import { rollup } from './rollup.ts';

export default {
  async fetch(req, env): Promise<Response> {
    if (new URL(req.url).pathname === '/e') return handleEvents(req, env);
    return env.ASSETS.fetch(req);
  },
  async scheduled(controller, env, ctx): Promise<void> {
    ctx.waitUntil(rollup(env, new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Env>;
