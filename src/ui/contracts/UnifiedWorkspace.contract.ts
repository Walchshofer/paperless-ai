import { z } from 'zod';
import { ManualDocumentSchema } from './ManualWorkspace.contract';
import { ModelConfigSchema, TextRagStatusSchema } from './ChatWorkspace.contract';

export const UnifiedWorkspaceSchema = z.object({
  version: z.string(),
  config: z.object({
    disableGithubFetch: z.string().default('no'),
  }),
  document: z.object({
    id: z.number().int().nullable(),
    title: z.string().nullable(),
    content: z.string().nullable(),
    correspondent: z.string().nullable(),
    correspondentId: z.number().int().nullable(),
    documentType: z.string().nullable(),
    documentTypeId: z.number().int().nullable(),
    tags: z.array(z.string()).default([]),
    pageCount: z.number().int().nullable(),
    currentPage: z.number().int().default(1),
    mimeType: z.string().nullable(),
    originalUrl: z.string().nullable(),
    normalizedUrl: z.string().nullable(),
  }).nullable(),
  
  // Workspace specific data
  availableDocuments: z.array(ManualDocumentSchema).default([]),
  
  // Chat context
  chat: z.object({
    aiProvider: z.string().optional(),
    ollamaDefaultModel: z.string().nullable().optional(),
    modelConfig: ModelConfigSchema.optional(),
    textRagStatus: TextRagStatusSchema.optional(),
  }),

  // Visual/RAG context
  visual: z.object({
    fields: z.array(z.object({
      label: z.string(),
      value: z.any(),
      domain: z.string(),
      confidence: z.number(),
      paperlessMapping: z.string().nullable(),
      isMandatory: z.boolean(),
      pageNumber: z.number().int(),
    })).default([]),
    overlayCount: z.number().int().default(0),
  }),

  // UI State
  ui: z.object({
    activeTab: z.enum(['metadata', 'chat', 'ocr']).default('metadata'),
    sidebarCollapsed: z.boolean().default(false),
  }).default({}),
});

export type UnifiedWorkspaceContract = z.infer<typeof UnifiedWorkspaceSchema>;
