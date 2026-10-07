import { z } from 'zod';

export const ManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  countries: z.record(z.string(), z.strictObject({
    status: z.enum(['available', 'planned']), release: z.string(), path: z.string(),
    latestRecordDate: z.string(), lastChangedAt: z.string(), reason: z.string().optional(),
  })),
});

export const ScheduleFileSchema = z.strictObject({
  generatedAt: z.string(),
  items: z.array(z.strictObject({ cc: z.string(), meetingId: z.string(), announceAt: z.string(), resolved: z.boolean() })),
});

export const HealthFileSchema = z.record(z.string(), z.strictObject({
  checkedAt: z.string(), status: z.enum(['ok', 'pending', 'failed']), detail: z.string().optional(),
}));

export type Manifest = z.infer<typeof ManifestSchema>;
export type ScheduleFile = z.infer<typeof ScheduleFileSchema>;
export type HealthFile = z.infer<typeof HealthFileSchema>;
