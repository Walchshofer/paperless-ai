import { z } from 'zod';

export const ConnectionSettingsSchema = z.object({
  paperlessApiUrl: z.string().url().optional(),
  paperlessApiToken: z.string().optional(),
  paperlessUsername: z.string().optional(),
  testConnectionTimeoutMs: z.number().int().nonnegative().optional().default(5000),
});

export type ConnectionSettings = z.infer<typeof ConnectionSettingsSchema>;
