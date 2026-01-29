import { z } from 'zod';

export const DocumentContentSchema = z.object({
  documentId: z.number().nullable().optional(),
  content: z.string().optional(),
  initialQuery: z.string().optional()
});

export type DocumentContentContract = z.infer<typeof DocumentContentSchema>;
