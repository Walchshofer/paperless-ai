import { z } from 'zod';

/**
 * Prompts Settings Contract
 *
 * Defines the shape of prompt management settings for the PromptsSettingsIsland.
 * Used for managing expert pipeline prompt templates.
 */

const PromptConfigSchema = z.object({
  temperature: z.number().min(0).max(2).optional().default(0.2),
  maxTokens: z.number().int().positive().optional().default(2048),
  topK: z.number().int().positive().optional().default(40),
  topP: z.number().min(0).max(1).optional().default(0.9),
});

const PromptEntrySchema = z.object({
  // Read-only metadata
  id: z.string(),
  version: z.string(),
  domain: z.enum(['System', 'Medical', 'Financial', 'Legal', 'General']),
  model: z.string(),
  modelType: z.enum(['multimodal', 'text_only']),
  category: z.string().optional(),

  // Editable content
  systemPrompt: z.string(),
  userTemplate: z.string(),
  config: PromptConfigSchema,

  // Computed (server-side)
  templateVariables: z.array(z.string()).optional().default([]),
  isModified: z.boolean().optional().default(false),
});

export const PromptsSettingsSchema = z.object({
  prompts: z.array(PromptEntrySchema).optional().default([]),
  domainCounts: z.record(z.string(), z.number()).optional().default({}),
});

/** Validation result returned from PUT /api/prompts/:id on 422 or as warnings */
export const PromptValidationSchema = z.object({
  errors: z.array(z.string()).optional().default([]),
  warnings: z.array(z.string()).optional().default([]),
  suggestions: z.array(z.string()).optional().default([]),
  quality_score: z.number().min(0).max(1).optional(),
  syntax_valid: z.boolean().optional(),
  detected_variables: z.array(z.string()).optional().default([]),
  unrecognized_variables: z.array(z.string()).optional().default([]),
});

/** Test result returned from POST /api/prompts/:id/test */
export const PromptTestResultSchema = z.object({
  success: z.boolean(),
  promptId: z.string(),
  source: z.string(),
  duration: z.number(),
  renderedSystemPrompt: z.string(),
  renderedTemplate: z.string(),
  detectedVariables: z.array(z.string()),
  missingVariables: z.array(z.string()),
  providedVariables: z.array(z.string()),
  tokenEstimate: z.number(),
  testResult: z.any().nullable(),
  jsonValid: z.boolean().nullable(),
});

export type PromptEntry = z.infer<typeof PromptEntrySchema>;
export type PromptConfig = z.infer<typeof PromptConfigSchema>;
export type PromptsSettings = z.infer<typeof PromptsSettingsSchema>;
export type PromptValidation = z.infer<typeof PromptValidationSchema>;
export type PromptTestResult = z.infer<typeof PromptTestResultSchema>;
