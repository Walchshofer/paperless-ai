import { z } from 'zod';

export const ChatDocumentSchema = z.object({
  id: z.number().int(),
  title: z.string().optional(),
  original_filename: z.string().optional()
});

export const ModelConfigSchema = z.object({
  providers: z.record(z.array(z.string())).optional().default({}),
  expertModels: z.array(z.object({ model: z.string(), label: z.string().optional(), category: z.string().optional() })).optional().default([]),
  currentProvider: z.string().optional()
});

export const TextRagStatusSchema = z.object({
  available: z.boolean().optional(),
  circuitBreakerState: z.string().optional()
});

export const ChatSourceSchema = z.object({
  documentId: z.number().int(),
  title: z.string().optional(),
  page: z.number().int().optional(),
  confidence: z.number().optional(),
  visualScore: z.number().optional(),
  textScore: z.number().optional()
});

export const ChatModeSchema = z.enum(['rag', 'visual-rag', 'document']);

export const SearchModeSchema = z.enum(['rag', 'hybrid', 'text-fallback']);

export const ChatWorkspaceSchema = z.object({
  openDocumentId: z.number().int().nullable().optional(),
  documents: z.array(ChatDocumentSchema).optional().default([]),
  aiProvider: z.string().optional(),
  ollamaDefaultModel: z.string().nullable().optional(),
  modelConfig: ModelConfigSchema.optional(),
  textRagStatus: TextRagStatusSchema.optional()
});

export type ChatWorkspaceContract = z.infer<typeof ChatWorkspaceSchema>;
export type ChatSource = z.infer<typeof ChatSourceSchema>;
export type ChatMode = z.infer<typeof ChatModeSchema>;
export type SearchMode = z.infer<typeof SearchModeSchema>;
