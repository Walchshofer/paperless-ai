import { z } from 'zod';

/**
 * Expert Models Settings Contract
 *
 * Defines the shape of expert model configuration props for the ExpertModelsIsland.
 * Supports 3 domains: Medical, Financial, and Legal.
 */

const MedicalModelsSchema = z.object({
  vision: z.string().optional().default('llava-med-v1.6'),
  analysis: z.string().optional().default('medtext-llama3'),
  radiology: z.string().optional().default('llava-med-v1.6'),
});

const FinancialModelsSchema = z.object({
  analysis: z.string().optional().default('fino1-8b'),
  reasoning: z.string().optional().default('llm-pro-finance-8b'),
  vision: z.string().optional().default('llm-pro-finance-8b'),
  vatExpert: z.string().optional().default('llm-pro-finance-8b'),
});

const LegalModelsSchema = z.object({
  vision: z.string().optional().default('qwen3-vl:8b'),
  analysis: z.string().optional().default('gpt-oss'),
  orchestrator: z.string().optional(),
});

export const ExpertModelsSettingsSchema = z.object({
  // Medical domain models
  medical: MedicalModelsSchema.optional(),

  // Financial domain models
  financial: FinancialModelsSchema.optional(),

  // Legal domain models
  legal: LegalModelsSchema.optional(),

  // Expert pipeline enabled toggle
  expertPipelineEnabled: z.boolean().optional().default(true),

  // Auto-save debounce interval (ms)
  autoSaveDebounceMs: z.number().int().positive().optional().default(1000),
});

export type ExpertModelsSettings = z.infer<typeof ExpertModelsSettingsSchema>;
