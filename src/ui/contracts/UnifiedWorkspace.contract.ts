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
    createdDate: z.string().nullable().optional(),
    documentType: z.string().nullable(),
    documentTypeId: z.number().int().nullable(),
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
      field: z.unknown().optional(),
      name: z.string().optional(),
      value: z.unknown().optional(),
    }).passthrough()).optional().default([]),
    tags: z.array(z.string()).default([]),
    tagItems: z.array(z.object({
      id: z.number().int(),
      name: z.string(),
      color: z.string().nullable().optional(),
    })).optional().default([]),
    availableTags: z.array(z.object({
      id: z.number().int(),
      name: z.string(),
      color: z.string().nullable().optional(),
    })).optional().default([]),
    pageCount: z.number().int().nullable(),
    currentPage: z.number().int().default(1),
    mimeType: z.string().nullable(),
    originalUrl: z.string().nullable(),
    normalizedUrl: z.string().nullable(),
    persistedNormalizedUrl: z.string().nullable(),
    normalizationStatus: z.enum(['pending', 'processing', 'completed', 'failed', 'skipped']).nullable(),
    visOcrPages: z.array(z.object({
      pageNumber: z.number().int().positive(),
      text: z.string(),
      success: z.boolean().optional(),
    })).optional().default([]),
    visOcrSource: z.string().nullable().optional(),
    visOcrQuality: z.number().nullable().optional(),
  }).nullable(),

  // User context (for permissioned UI like Debug tab)
  user: z.object({
    username: z.string().nullable().optional(),
    isAdmin: z.boolean().optional(),
  }).optional(),
  
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
      id: z.string().optional(),
      label: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
      domain: z.string(),
      confidence: z.number(),
      paperlessMapping: z.string().nullable(),
      paperlessField: z.string().nullable().optional(),
      mappingConfidence: z.number().nullable().optional(),
      matchType: z.enum(['exact', 'fuzzy', 'none']).nullable().optional(),
      overlayId: z.string().nullable().optional(),
      isMandatory: z.boolean(),
      pageNumber: z.number().int(),
    })).default([]),
    overlays: z.array(z.object({
      id: z.string().optional(),
      label: z.string().optional(),
      pageNumber: z.number().int(),
      confidence: z.number().optional(),
      bbox: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number()
      }),
      paperlessMapping: z.string().nullable().optional(),
      paperlessField: z.string().nullable().optional(),
      overlayId: z.string().nullable().optional()
    })).optional().default([]),
    overlayCount: z.number().int().default(0),
  }),

  // UI State
  ui: z.object({
    activeTab: z.enum(['metadata', 'content', 'chat', 'debug']).default('metadata'),
    sidebarCollapsed: z.boolean().default(false),
  }).default({}),
});

export type UnifiedWorkspaceContract = z.infer<typeof UnifiedWorkspaceSchema>;
