const { z } = require('zod');

const ManualDocumentSchema = z.object({
  id: z.coerce.number().int(),
  title: z.string().optional(),
  original_filename: z.string().optional(),
});

const ModelConfigSchema = z.object({
  providers: z.record(z.array(z.string())).optional().default({}),
  expertModels: z.array(z.object({ model: z.string(), label: z.string().optional(), category: z.string().optional() })).optional().default([]),
  currentProvider: z.string().optional()
});

const TextRagStatusSchema = z.object({
  available: z.boolean().optional(),
  circuitBreakerState: z.string().optional()
});

const UnifiedWorkspaceSchema = z.object({
  version: z.string(),
  config: z.object({
    disableGithubFetch: z.string().default('no'),
  }),
  document: z.object({
    id: z.coerce.number().int().nullable(),
    title: z.string().nullable(),
    content: z.string().nullable(),
    correspondent: z.string().nullable(),
    correspondentId: z.coerce.number().int().nullable(),
    documentType: z.string().nullable(),
    documentTypeId: z.coerce.number().int().nullable(),
    tags: z.array(z.string()).default([]),
    pageCount: z.coerce.number().int().nullable(),
    currentPage: z.coerce.number().int().default(1),
    mimeType: z.string().nullable(),
    originalUrl: z.string().nullable(),
    normalizedUrl: z.string().nullable(),
    status: z.enum(['saved', 'unsaved', 'processing', 'error']).default('saved'),
  }).nullable(),
  
  availableDocuments: z.array(ManualDocumentSchema).default([]),
  
  chat: z.object({
    aiProvider: z.string().optional(),
    ollamaDefaultModel: z.string().nullable().optional(),
    modelConfig: ModelConfigSchema.optional(),
    textRagStatus: TextRagStatusSchema.optional(),
  }),

  visual: z.object({
    fields: z.array(z.object({
      label: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
      domain: z.string(),
      confidence: z.coerce.number(),
      paperlessMapping: z.string().nullable().optional(),
      isMandatory: z.boolean().default(false),
      pageNumber: z.coerce.number().int().default(1),
    })).default([]),
    overlayCount: z.coerce.number().int().default(0),
  }),

  ui: z.object({
    activeTab: z.enum(['metadata', 'content', 'chat', 'debug']).default('metadata'),
    sidebarCollapsed: z.boolean().default(false),
  }).default({}),

  user: z.object({
    username: z.string(),
    isAdmin: z.boolean().default(false),
  }).optional(),
});

module.exports = {
  UnifiedWorkspaceSchema,
};
