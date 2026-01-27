import { z } from 'zod';

export const ManualDocumentSchema = z.object({
  id: z.number().int(),
  title: z.string().optional(),
  original_filename: z.string().optional(),
});

export const ManualWorkspaceSchema = z.object({
  documentId: z.number().int().nullable().optional(),
  content: z.string().optional(),
  title: z.string().nullable().optional(),
  correspondent: z.string().nullable().optional(),
  tags: z.array(z.union([z.string(), z.number()])).optional().default([]),
  originalUrl: z.string().nullable().optional(),
  pageCount: z.number().int().nullable().optional(),
  documents: z.array(ManualDocumentSchema).optional().default([]),
});

export type ManualWorkspaceContract = z.infer<typeof ManualWorkspaceSchema>;
