import { z } from 'zod';

export const ChatDocumentSchema = z.object({
  id: z.number().int(),
  title: z.string().optional(),
  original_filename: z.string().optional()
});

export const ModelConfigSchema = z.object({
  providers: z.record(z.array(z.string())).optional().default({}),
  expertModels: z.array(z.unknown()).optional().default([]),
  currentProvider: z.string().optional()
});

export const TextRagStatusSchema = z.object({
  available: z.boolean().optional(),
  circuitBreakerState: z.string().optional()
});

export const ChatWorkspaceSchema = z.object({
  openDocumentId: z.number().int().nullable().optional(),
  documents: z.array(ChatDocumentSchema).optional().default([]),
  aiProvider: z.string().optional(),
  ollamaDefaultModel: z.string().nullable().optional(),
  modelConfig: ModelConfigSchema.optional(),
  textRagStatus: TextRagStatusSchema.optional()
});

export type ChatWorkspaceContract = z.infer<typeof ChatWorkspaceSchema>;
