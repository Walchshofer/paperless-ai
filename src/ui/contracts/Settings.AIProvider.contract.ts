import { z } from 'zod';

/**
 * AI Provider Settings Contract
 *
 * Defines the shape of AI provider configuration props for the AIProviderIsland.
 * Connection details (URLs, API Keys) are now managed in the Connection Center.
 */

const TokenLimitsSchema = z.object({
  contextWindow: z.number().int().positive().optional().default(128000),
  maxResponseTokens: z.number().int().positive().optional().default(4096),
});

const ModelEntrySchema = z.object({
  name: z.string().optional(),
  promptId: z.string().optional(),
  limits: TokenLimitsSchema.optional(),
});

const OllamaSchema = z.object({
  // Base Models
  text: ModelEntrySchema.optional(),
  vision: ModelEntrySchema.optional(),
  
  // Pipeline Models
  router: ModelEntrySchema.optional(),
  planner: ModelEntrySchema.optional(),
  orchestrator: ModelEntrySchema.optional(),
  
  // Service Models
  translation: ModelEntrySchema.optional(),
  guidance: ModelEntrySchema.optional(),
  
  // Legacy fields for backward compatibility during transition
  model: z.string().optional(),
  visionModel: z.string().optional(),
  
  imageTokenOverhead: z.number().int().nonnegative().optional().default(1024),
});

const CustomSchema = z.object({
  model: ModelEntrySchema.optional(),
});

const AzureSchema = z.object({
  deploymentName: z.string().optional().default(''),
  apiVersion: z.string().optional().default('2023-05-15'),
  model: ModelEntrySchema.optional(),
});

const ExpertMedicalSchema = z.object({
  vision: ModelEntrySchema.optional(),
  analysis: ModelEntrySchema.optional(),
  radiology: ModelEntrySchema.optional(),
  integrator: ModelEntrySchema.optional(),
});

const ExpertFinancialSchema = z.object({
  vision: ModelEntrySchema.optional(),
  analysis: ModelEntrySchema.optional(),
  reasoning: ModelEntrySchema.optional(),
  vatExpert: ModelEntrySchema.optional(),
});

const ExpertLegalSchema = z.object({
  vision: ModelEntrySchema.optional(),
  analysis: ModelEntrySchema.optional(),
  orchestrator: ModelEntrySchema.optional(),
});

export const AIProviderSettingsSchema = z.object({
  // Provider selection (General tab)
  provider: z.enum(['openai', 'ollama', 'azure', 'custom']).optional().default('openai'),

  // Provider-specific configurations (non-connection settings only)
  ollama: OllamaSchema.optional(),
  custom: CustomSchema.optional(),
  azure: AzureSchema.optional(),

  // Global Model & Token Settings (Moved from Developer/General)
  globalLimits: z.object({
    tokenLimit: z.number().int().positive().optional().default(128000),
    responseTokens: z.number().int().positive().optional().default(4096),
  }).optional(),

  qualitySettings: z.object({
    textQualityThreshold: z.number().int().min(0).max(100).optional().default(60),
    maxVisionPages: z.number().int().positive().optional().default(4),
  }).optional(),

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