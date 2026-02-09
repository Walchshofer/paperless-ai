import { z } from 'zod';

/**
 * AI Provider Settings Contract
 *
 * Defines the shape of AI provider configuration props for the AIProviderIsland.
 * Supports 5 providers: OpenAI, Ollama, Custom, Azure, and a General tab for provider selection.
 * The Ollama tab includes pipeline-first model configuration with inline expert models.
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
  translationModel: z.string().optional(),
  guidanceModel: z.string().optional(),
  visionKeepAlive: z.string().optional().default('5m'),
  textKeepAlive: z.string().optional().default('2m'),
  routerKeepAlive: z.string().optional().default('5m'),
  limits: z.object({
    text: TokenLimitsSchema.optional(),
    vision: TokenLimitsSchema.optional(),
    planner: TokenLimitsSchema.optional(),
    expert: TokenLimitsSchema.optional(),
    translation: TokenLimitsSchema.extend({
      maxResponseTokens: z.number().int().positive().optional(),
    }).optional(),
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

const ExpertMedicalSchema = z.object({
  vision: z.string().optional().default('llava-med-v1.6'),
  analysis: z.string().optional().default('medtext-llama3'),
  radiology: z.string().optional().default('llava-med-v1.6'),
});

const ExpertFinancialSchema = z.object({
  vision: z.string().optional().default('llm-pro-finance-8b'),
  analysis: z.string().optional().default('fino1-8b'),
  reasoning: z.string().optional().default('llm-pro-finance-8b'),
  vatExpert: z.string().optional().default('llm-pro-finance-8b'),
});

const ExpertLegalSchema = z.object({
  vision: z.string().optional().default('qwen3-vl:8b'),
  analysis: z.string().optional().default('gpt-oss'),
  orchestrator: z.string().optional().default(''),
});

export const AIProviderSettingsSchema = z.object({
  // Provider selection (General tab)
  provider: z.enum(['openai', 'ollama', 'azure', 'custom']).optional().default('openai'),

  // Provider-specific configurations
  openai: OpenAISchema.optional(),
  ollama: OllamaSchema.optional(),
  custom: CustomSchema.optional(),
  azure: AzureSchema.optional(),

  // Available Ollama models for dropdown
  availableModels: z.object({
    ollama: z.array(z.string()).optional().default([]),
  }).optional().default({}),

  // Prompt registry mapping: model role -> prompt ID
  promptRegistry: z.record(z.string(), z.string()).optional().default({}),

  // Expert models (absorbed from ExpertModelsIsland)
  expertPipelineEnabled: z.boolean().optional().default(true),
  expertModels: z.object({
    medical: ExpertMedicalSchema.optional(),
    financial: ExpertFinancialSchema.optional(),
    legal: ExpertLegalSchema.optional(),
  }).optional(),

  // Factory defaults for reset functionality
  defaults: z.object({
    ollama: OllamaSchema.optional(),
    expert: z.object({
      medical: ExpertMedicalSchema.optional(),
      financial: ExpertFinancialSchema.optional(),
      legal: ExpertLegalSchema.optional(),
    }).optional(),
  }).optional(),

  // Auto-save debounce interval (ms)
  autoSaveDebounceMs: z.number().int().positive().optional().default(1000),
});

export type AIProviderSettings = z.infer<typeof AIProviderSettingsSchema>;
