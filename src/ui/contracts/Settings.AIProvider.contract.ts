import { z } from 'zod';

/**
 * AI Provider Settings Contract
 *
 * Defines the shape of AI provider configuration props for the AIProviderIsland.
 * Supports 5 providers: OpenAI, Ollama, Custom, Azure, and a General tab for provider selection.
 */

const TokenLimitsSchema = z.object({
  contextWindow: z.number().int().positive().optional().default(128000),
  maxResponseTokens: z.number().int().positive().optional().default(4096),
});

const OpenAISchema = z.object({
  apiKey: z.string().optional().default(''),
});

const OllamaSchema = z.object({
  apiUrl: z.string().url().optional().default('http://localhost:11434'),
  model: z.string().optional().default('sauerkraut-llama3.1:8b'),
  repairModel: z.string().optional(),
  visionModel: z.string().optional().default('qwen3-vl:8b'),
  plannerModel: z.string().optional(),
  routerModel: z.string().optional(),
  orchestratorModel: z.string().optional(),
  visionKeepAlive: z.string().optional().default('5m'),
  textKeepAlive: z.string().optional().default('2m'),
  routerKeepAlive: z.string().optional().default('5m'),
  limits: z.object({
    text: TokenLimitsSchema.optional(),
    vision: TokenLimitsSchema.optional(),
    planner: TokenLimitsSchema.optional(),
    expert: TokenLimitsSchema.optional(),
    imageTokenOverhead: z.number().int().nonnegative().optional().default(1024),
  }).optional(),
});

const CustomSchema = z.object({
  apiUrl: z.string().optional().default(''),
  apiKey: z.string().optional().default(''),
  model: z.string().optional().default(''),
});

const AzureSchema = z.object({
  apiKey: z.string().optional().default(''),
  endpoint: z.string().optional().default(''),
  deploymentName: z.string().optional().default(''),
  apiVersion: z.string().optional().default('2023-05-15'),
});

export const AIProviderSettingsSchema = z.object({
  // Provider selection (General tab)
  provider: z.enum(['openai', 'ollama', 'azure', 'custom']).optional().default('openai'),

  // Provider-specific configurations
  openai: OpenAISchema.optional(),
  ollama: OllamaSchema.optional(),
  custom: CustomSchema.optional(),
  azure: AzureSchema.optional(),

  // Auto-save debounce interval (ms)
  autoSaveDebounceMs: z.number().int().positive().optional().default(1000),
});

export type AIProviderSettings = z.infer<typeof AIProviderSettingsSchema>;
