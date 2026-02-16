const { z } = require('zod');

const ManualDocumentSchema = z.object({
  id: z.coerce.number().int(),
  title: z.string().optional(),
  original_filename: z.string().optional(),
});

const ModelConfigSchema = z.object({
  providers: z.record(z.array(z.string())).optional().default({}),
  expertModels: z.array(z.object({ model: z.string(), label: z.string().optional(), category: z.string().optional() })).optional().default([]),
  currentProvider: z.string().optional(),
  defaultModels: z.record(z.string()).optional().default({})
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
    createdDate: z.string().nullable().optional(),
    documentType: z.string().nullable(),
    documentTypeId: z.coerce.number().int().nullable(),
    documentDomain: z.string().nullable().optional(),
    fieldProfile: z.object({
      domain: z.string().optional(),
      displayName: z.string().optional(),
      icon: z.string().optional(),
      requiredFields: z.array(z.object({
        fieldId: z.string(),
        label: z.string().optional(),
        paperlessField: z.string().nullable().optional(),
        type: z.string().optional(),
        enum: z.array(z.string()).optional(),
        validationRules: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
        isMandatory: z.boolean().optional()
      })).optional(),
      optionalFields: z.array(z.object({
        fieldId: z.string(),
        label: z.string().optional(),
        paperlessField: z.string().nullable().optional(),
        type: z.string().optional(),
        enum: z.array(z.string()).optional(),
        validationRules: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
        isMandatory: z.boolean().optional()
      })).optional()
    }).optional(),
    customFields: z.array(z.object({
      field: z.any().optional(),
      name: z.string().optional(),
      value: z.any().optional(),
    }).passthrough()).optional().default([]),
    tags: z.array(z.string()).default([]),
    tagItems: z.array(z.object({
      id: z.coerce.number().int(),
      name: z.string(),
      color: z.string().nullable().optional(),
    })).optional().default([]),
    availableTags: z.array(z.object({
      id: z.coerce.number().int(),
      name: z.string(),
      color: z.string().nullable().optional(),
    })).optional().default([]),
    pageCount: z.coerce.number().int().nullable(),
    currentPage: z.coerce.number().int().default(1),
    mimeType: z.string().nullable(),
    originalUrl: z.string().nullable(),
    normalizedUrl: z.string().nullable(),
    persistedNormalizedUrl: z.string().nullable().optional(),
    normalizationStatus: z.enum(['pending', 'processing', 'completed', 'failed', 'skipped']).nullable().optional(),
    status: z.enum(['saved', 'unsaved', 'processing', 'error']).default('saved'),
    currentUser: z.string().optional(),
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
      id: z.string().optional(),
      label: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
      domain: z.string(),
      confidence: z.coerce.number(),
      paperlessMapping: z.string().nullable().optional(),
      paperlessField: z.string().nullable().optional(),
      mappingConfidence: z.coerce.number().nullable().optional(),
      matchType: z.enum(['exact', 'fuzzy', 'none']).nullable().optional(),
      overlayId: z.string().nullable().optional(),
      isMandatory: z.boolean().default(false),
      pageNumber: z.coerce.number().int().default(1),
    })).default([]),
    overlays: z.array(z.object({
      id: z.string().optional(),
      label: z.string().optional(),
      pageNumber: z.coerce.number().int().default(1),
      confidence: z.coerce.number().optional().default(0.5),
      bbox: z.object({
        x: z.coerce.number(),
        y: z.coerce.number(),
        width: z.coerce.number(),
        height: z.coerce.number(),
      }),
      paperlessMapping: z.string().nullable().optional(),
      paperlessField: z.string().nullable().optional(),
      overlayId: z.string().nullable().optional(),
    })).optional().default([]),
    overlayCount: z.coerce.number().int().default(0),
  }),

  ui: z.object({
    activeTab: z.enum(['metadata', 'content', 'chat', 'visual', 'debug']).default('metadata'),
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
