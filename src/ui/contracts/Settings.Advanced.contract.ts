import { z } from 'zod';

export const AdvancedSettingsSchema = z.object({
  tags: z.array(z.string()).optional().default([]),
  aiRestrictions: z.object({
    restrictToExistingTags: z.boolean().optional().default(false),
    restrictToExistingCorrespondents: z.boolean().optional().default(false),
    restrictToExistingDocumentTypes: z.boolean().optional().default(false),
  }).optional(),
  customFields: z.string().optional(), // raw CSV/JSON as string - further parsing done elsewhere
  systemPrompt: z.string().optional().nullable(),
});

export type AdvancedSettings = z.infer<typeof AdvancedSettingsSchema>;
