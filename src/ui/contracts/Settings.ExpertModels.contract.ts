import { z } from 'zod';

const DomainModelsSchema = z.object({
  enabled: z.boolean().default(false),
  vision: z.string().optional(),
  analysis: z.string().optional(),
  orchestrator: z.string().optional(),
});

export const ExpertModelsSettingsSchema = z.object({
  medical: DomainModelsSchema.optional(),
  financial: DomainModelsSchema.optional(),
  legal: DomainModelsSchema.optional(),
  expertPipelineEnabled: z.boolean().optional().default(true),
});

export type ExpertModelsSettings = z.infer<typeof ExpertModelsSettingsSchema>;
