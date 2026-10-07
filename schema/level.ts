import { z } from 'zod';

const bps = z.number().int();

export const LevelSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('point'), bps }),
  z.strictObject({ kind: z.literal('range'), lowBps: bps, highBps: bps })
    .refine(level => level.lowBps < level.highBps, { message: 'lowBps must be below highBps' }),
  z.strictObject({ kind: z.literal('none'), label: z.string().min(1) }),
]);

export type Level = z.infer<typeof LevelSchema>;

/** The comparable value of a level: the point, the upper bound of a range, or null when there is no rate target. */
export function upperBps(level: Level): number | null {
  if (level.kind === 'point') return level.bps;
  if (level.kind === 'range') return level.highBps;
  return null;
}

export function sameLevel(a: Level, b: Level): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'point' && b.kind === 'point') return a.bps === b.bps;
  if (a.kind === 'range' && b.kind === 'range') return a.lowBps === b.lowBps && a.highBps === b.highBps;
  return a.kind === 'none' && b.kind === 'none' && a.label === b.label;
}

const percent = (value: number) => (value / 100).toFixed(2).replace('-', '−');

/** "5.50%", "3.75 to 4.00%", or the label of an era without a rate target. Never a midpoint. */
export function formatLevel(level: Level): string {
  if (level.kind === 'point') return `${percent(level.bps)}%`;
  if (level.kind === 'range') return `${percent(level.lowBps)} to ${percent(level.highBps)}%`;
  return level.label;
}
