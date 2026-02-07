import { z } from 'zod';

/**
 * Developer Settings Contract
 *
 * Defines the shape of developer settings including feature flags and environment variables.
 * Only accessible when developer mode is enabled.
 */

const FeatureFlagsSchema = z.object({
  // Expert pipeline
  expertPipelineEnabled: z.boolean().optional().default(true),

  // Visual RAG
  visualRagEnabled: z.boolean().optional().default(false),
  visualRagSidecarEnabled: z.boolean().optional().default(false),
  forceVisualRag: z.boolean().optional().default(false),

  // Guidance service
  guidanceServiceEnabled: z.boolean().optional().default(true),

  // Metrics
  metricsEnabled: z.boolean().optional().default(true),

  // Duplicate detection
  duplicateDetectionEnabled: z.boolean().optional().default(true),

  // OCR checkpoint
  ocrCheckpointEnabled: z.boolean().optional().default(true),

  // Summary fallback
  summaryFallbackEnabled: z.boolean().optional().default(true),
});

const EnvironmentVariablesSchema = z.object({
  // Processing
  disableAutomaticProcessing: z.string().optional().default('no'),
  scanInterval: z.string().optional().default('*/30 * * * *'),

  // Token limits
  tokenLimit: z.number().int().positive().optional().default(128000),
  responseTokens: z.number().int().positive().optional().default(4096),

  // Visual RAG settings
  textQualityThreshold: z.number().int().min(0).max(100).optional().default(60),
  maxVisionPages: z.number().int().positive().optional().default(4),

  // Timeouts
  guidanceTimeout: z.number().int().positive().optional().default(90000),
  visualRagTimeout: z.number().int().positive().optional().default(30000),
});

// Ollama Model Token Limits (all local models)
const OllamaModelLimitsSchema = z.object({
  // Text (Base) tier
  ollamaContextWindow: z.number().int().positive().optional().default(128000),
  ollamaMaxResponseTokens: z.number().int().positive().optional().default(4096),

  // Vision tier (capped at 32k)
  ollamaVisionContextWindow: z.number().int().positive().max(32768).optional().default(32768),
  ollamaVisionMaxResponseTokens: z.number().int().positive().optional().default(2048),
  ollamaVisionImageTokens: z.number().int().positive().optional().default(1024),

  // Planner tier (capped at 32k)
  ollamaPlannerContextWindow: z.number().int().positive().max(32768).optional().default(32768),
  ollamaPlannerMaxResponseTokens: z.number().int().positive().optional().default(2048),

  // Expert tier
  ollamaExpertContextWindow: z.number().int().positive().optional().default(128000),
  ollamaExpertMaxResponseTokens: z.number().int().positive().optional().default(4096),

  // Translation tier
  translationContextWindow: z.number().int().positive().optional().default(128000),
});

export const DeveloperSettingsSchema = z.object({
  // Feature flags (auto-save, most don't require restart)
  featureFlags: FeatureFlagsSchema.optional(),

  // Environment variables (manual save, restart required)
  environmentVariables: EnvironmentVariablesSchema.optional(),

  // Ollama model token limits (manual save, restart required)
  ollamaModelLimits: OllamaModelLimitsSchema.optional(),

  // Auto-save debounce for feature flags (ms)
  autoSaveDebounceMs: z.number().int().positive().optional().default(500),
});

export type DeveloperSettings = z.infer<typeof DeveloperSettingsSchema>;
