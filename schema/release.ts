import { z } from 'zod';
import { LevelSchema } from './level.ts';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const zonedInstant = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/, 'expected an ISO instant with offset');
const id = z.string().min(1);

export const EraSchema = z.strictObject({
  id, from: isoDate, to: isoDate.nullable(), instrument: z.string().min(1),
  kind: z.enum(['point', 'range', 'none']), basis: z.enum(['policy', 'observation']), note: z.string().min(1), sourceId: id,
});

export const MeetingSchema = z.strictObject({
  id, date: isoDate, meetingStart: isoDate.nullable(), announceAt: zonedInstant, effectiveLagDays: z.number().int().min(0),
  status: z.enum(['scheduled', 'held', 'cancelled', 'moved']), movedTo: isoDate.optional(), sourceId: id,
});

export const DecisionSchema = z.strictObject({
  id, meetingId: id.nullable(), announcedAt: zonedInstant, effectiveDate: isoDate.nullable(), level: LevelSchema,
  direction: z.enum(['hike', 'cut', 'hold', 'unchanged', 'none']), changeBps: z.number().int().nullable(),
  eraChange: z.boolean(), offCycle: z.boolean(), evidence: z.enum(['statement', 'series', 'secondary']),
  vote: z.strictObject({ for: z.number().int().min(0), against: z.number().int().min(0), dissents: z.array(z.string()) }).nullable(),
  stance: z.string().nullable(), statementUrl: z.string().url().nullable(), excerpt: z.string().nullable(), sourceIds: z.array(id).min(1),
});

export const SeriesPointSchema = z.strictObject({ date: isoDate, level: LevelSchema, evidence: z.enum(['official', 'secondary']), sourceId: id });

export const TransmissionSchema = z.strictObject({
  product: z.string().min(1), benchmark: z.string().min(1), spreadBps: z.number().int().optional(), reset: z.string().min(1),
  adjusts: z.enum(['payment', 'tenure', 'both']), passThrough: z.enum(['direct', 'lagged', 'weak', 'none']), note: z.string().min(1), sourceId: id,
});

export const SourceSchema = z.strictObject({
  id, type: z.string().min(1), title: z.string().min(1), url: z.string().url(), official: z.boolean(),
  publishedAt: z.string().nullable(), retrievedAt: z.string().nullable(), sha256: z.string().nullable(),
});

export const ContextEventSchema = z.strictObject({ date: isoDate, label: z.string().min(1), description: z.string().min(1), sourceId: id });

export const CountryReleaseSchema = z.strictObject({
  schemaVersion: z.literal(3),
  country: z.strictObject({ code: z.string().regex(/^[A-Z]{2}$/), name: z.string(), currency: z.string().length(3), locale: z.string(), timeZone: z.string() }),
  authority: z.strictObject({ name: z.string(), short: z.string(), body: z.string(), bodyShort: z.string(), url: z.string().url() }),
  instrument: z.strictObject({ name: z.string(), short: z.string(), explainer: z.string() }),
  eras: z.array(EraSchema).min(1),
  calendar: z.array(MeetingSchema),
  decisions: z.array(DecisionSchema),
  series: z.array(SeriesPointSchema).min(1),
  transmission: z.array(TransmissionSchema),
  context: z.array(ContextEventSchema),
  sources: z.array(SourceSchema).min(1),
  coverage: z.strictObject({ seriesFrom: isoDate, seriesThrough: isoDate, ledgerFrom: isoDate.nullable(), grain: z.string() }),
  corrections: z.array(z.strictObject({ recordId: id, reason: z.string().min(1), sourceId: id })).default([]),
  release: z.strictObject({ hash: z.string(), generator: z.string(), upstream: z.strictObject({ kind: z.string(), id: z.string(), sha256: z.string() }).optional() }),
});

export type Era = z.infer<typeof EraSchema>;
export type Meeting = z.infer<typeof MeetingSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type SeriesPoint = z.infer<typeof SeriesPointSchema>;
export type Transmission = z.infer<typeof TransmissionSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type ContextEvent = z.infer<typeof ContextEventSchema>;
export type CountryRelease = z.infer<typeof CountryReleaseSchema>;
