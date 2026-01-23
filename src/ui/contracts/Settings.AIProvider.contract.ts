import { z } from 'zod';

const OpenAISchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

const OllamaSchema = z.object({
  apiUrl: z.string().optional(),
  model: z.string().optional(),
  visionModel: z.string().optional(),
  keepAlive: z.string().optional(),
});

const AzureSchema = z.object({
  apiKey: z.string().optional(),
  endpoint: z.string().optional(),
  deploymentName: z.string().optional(),
});

export const AIProviderSettingsSchema = z.object({
  provider: z.enum(['openai', 'ollama', 'azure', 'custom']).default('openai'),
  general: z.object({
    maxTokens: z.number().int().nonnegative().optional(),
    temperature: z.number().min(0).max(2).optional(),
  }).optional(),
  openai: OpenAISchema.optional(),
  ollama: OllamaSchema.optional(),
  azure: AzureSchema.optional(),
  custom: z.record(z.any()).optional(),
});

export type AIProviderSettings = z.infer<typeof AIProviderSettingsSchema>;
