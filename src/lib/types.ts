/** The compact view of every published release that the site embeds and the client models (built by scripts/build-atlas.ts). */
export type Code = 'IN' | 'US' | 'EA' | 'GB' | 'CA' | 'AU' | 'BR';

export type Transmission = { product: string; benchmark: string; reset: string; passThrough: string; note: string; spreadBps?: number; adjusts?: string; sourceId?: string };

export type RawDecision = {
  /** Announcement date (YYYY-MM-DD, the authority's local date). */
  date: string;
  effective: string | null;
  lo: number; hi: number;
  change: number | null;
  dir: string;
  vote: { for: number; against: number; dissents: string[] } | null;
  stance: string | null;
  excerpt: string | null;
  url: string | null;
  offCycle: boolean;
};

export type AtlasCountry = {
  cc: Code;
  /** First 12 characters of the release hash. */
  release: string;
  policyFrom: string;
  eras: { from: string; to: string | null; basis: 'policy' | 'observation'; label: string; note: string }[];
  /** Change points: [date, lowBps, highBps, official ? 1 : 0]; a point level has low = high. */
  series: [string, number, number, 0 | 1][];
  decisions: RawDecision[];
  /** Unresolved scheduled announcements (ISO instants with offset), soonest first. */
  next: string[];
  transmission: Transmission[];
  sources: number;
};

export type AtlasData = { generatedAt: string; countries: Partial<Record<Code, AtlasCountry>> };
