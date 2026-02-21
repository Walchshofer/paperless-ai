import { z } from 'zod';

export const DocumentContentSchema = z.object({
  documentId: z.number().nullable().optional(),
  content: z.string().optional(),
  initialQuery: z.string().optional(),
  visOcrPages: z.array(z.object({
    pageNumber: z.number(),
    text: z.string(),
    success: z.boolean().optional()
  })).optional(),
  visOcrSource: z.string().nullable().optional(),
  visOcrQuality: z.number().nullable().optional()
});

export type DocumentContentContract = z.infer<typeof DocumentContentSchema>;
