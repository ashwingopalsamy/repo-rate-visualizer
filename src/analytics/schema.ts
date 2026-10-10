/* The analytics contract shared by the client (src/analytics/track.ts) and the collector (worker/site/events.ts).
   Every event and every property value is allowlisted; anything else is rejected by the collector. */
export const CODES = ['IN', 'US', 'EA', 'GB', 'CA', 'AU', 'BR'] as const;
export const ROUTES = ['world', 'country', 'privacy', 'design', 'notfound'] as const;
export const VIA = ['palette', 'ladder', 'latest', 'league', 'dock', 'link', 'history', 'prompt'] as const;

export type CodeValue = (typeof CODES)[number];
/** Event name → the property names it carries and the values each may take. */
export const EVENTS = {
  page: { route: ROUTES, cc: CODES },
  country_switch: { from: CODES, to: CODES, via: VIA },
  loan_calc: { cc: CODES, mode: ['decision', 'since'] },
  tile_open: { cc: CODES, tile: ['record', 'cycle', 'gap', 'peers'] },
  replay: { cc: CODES },
  dday_preview: { cc: CODES, state: ['live', 'announced', 'decided'] },
  palette_open: { from: ['keyboard', 'button'] },
  source_click: { cc: CODES },
  theme: { to: ['light', 'dark'] },
  decision_window: { cc: CODES },
  /** The first-visit country prompt: cc is the suggestion when shown, or the bank picked. */
  prompt: { action: ['shown', 'pick', 'keep', 'close'], cc: CODES },
} as const satisfies Record<string, Record<string, readonly string[]>>;

export type EventName = keyof typeof EVENTS;
export type EventProps<N extends EventName> = { [K in keyof (typeof EVENTS)[N]]?: (typeof EVENTS)[N][K] extends readonly (infer V)[] ? V : never };
export type WireEvent = { n: EventName; p: Record<string, string> };
/** The batch the client posts to /e. */
export type WireBatch = { v: 1; path: string; e: WireEvent[] };

/** The Analytics Engine dataset the collector writes to (wrangler.jsonc). */
export const DATASET = 'atlas_events';
export const MAX_EVENTS = 20;
export const MAX_BYTES = 2048;
