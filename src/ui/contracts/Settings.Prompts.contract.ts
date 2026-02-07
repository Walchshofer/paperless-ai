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

export type PromptEntry = z.infer<typeof PromptEntrySchema>;
export type PromptConfig = z.infer<typeof PromptConfigSchema>;
export type PromptsSettings = z.infer<typeof PromptsSettingsSchema>;
