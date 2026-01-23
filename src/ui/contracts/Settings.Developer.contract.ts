import { z } from 'zod';

export const DeveloperSettingsSchema = z.object({
  developerMode: z.boolean().optional().default(false),
  featureFlags: z.record(z.boolean()).optional().default({}),
  logLevel: z.enum(['debug','info','warn','error']).optional().default('info'),
  performance: z.object({
    timeouts: z.record(z.number()).optional().default({}),
    circuitBreakerThresholds: z.record(z.number()).optional().default({}),
    vramLimitMb: z.number().int().optional().nullable(),
  }).optional(),
  runtimeStateAutoRefreshSeconds: z.number().int().optional().default(10),
});

export type DeveloperSettings = z.infer<typeof DeveloperSettingsSchema>;
