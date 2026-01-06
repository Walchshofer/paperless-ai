import { z } from 'zod';

export const ManualEditorSchema = z.object({
  documentId: z.number().int().nullable(),
  metadata: z.record(z.any()).optional(),
  content: z.string().optional(),
  fields: z.array(z.object({ name: z.string(), value: z.any() })).optional(),
});

export type ManualEditorContract = z.infer<typeof ManualEditorSchema>;
