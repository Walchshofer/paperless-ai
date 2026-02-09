import { z } from 'zod';

export const import { z } from 'zod';

export const ConnectionSettingsSchema = z.object({
  // Paperless-ngx
  paperlessApiUrl: z.string().url().optional(),
  paperlessApiToken: z.string().optional(),
  paperlessUsername: z.string().optional(),
  
  // AI Providers
  ollamaApiUrl: z.string().url().optional(),
  openaiApiKey: z.string().optional(),
  azureEndpoint: z.string().url().optional(),
  azureApiKey: z.string().optional(),
  customApiUrl: z.string().url().optional(),
  customApiKey: z.string().optional(),

  // Vector Store (Qdrant)
  qdrantHost: z.string().optional(),
  qdrantPort: z.string().optional(),
  qdrantApiKey: z.string().optional(),

  // External API
  externalApiEnabled: z.boolean().optional(),
  externalApiUrl: z.string().url().optional(),
  externalApiMethod: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  externalApiHeaders: z.string().optional(),
  externalApiBody: z.string().optional(),
  externalApiTimeout: z.number().optional(),
  externalApiTransform: z.string().optional(),

  testConnectionTimeoutMs: z.number().int().nonnegative().optional().default(5000),
});

export type ConnectionSettings = z.infer<typeof ConnectionSettingsSchema>;;

export type ConnectionSettings = z.infer<typeof ConnectionSettingsSchema>;
