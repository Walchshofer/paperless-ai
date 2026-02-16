import { z } from 'zod';

// Smart metadata field values are typically scalar (string/number/boolean) or small arrays of strings
export const SmartFieldValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

export const FieldValidationRulesSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minItems: z.number().optional(),
  maxItems: z.number().optional(),
  pattern: z.string().optional(),
  format: z.string().optional(),
  currency: z.boolean().optional(),
});

export const SmartFieldSchema = z.object({
  id: z.union([z.string(), z.number()]),
  fieldId: z.string(),
  label: z.string().optional(),
  value: SmartFieldValueSchema.optional(),
  overlayId: z.string().nullable().optional(),
  pageNumber: z.number().nullable().optional(),
  paperlessField: z.string().nullable().optional(),
  paperlessMapping: z.string().nullable().optional(),
  mappingConfidence: z.number().nullable().optional(),
  matchType: z.enum(['exact', 'fuzzy', 'none']).nullable().optional(),
  confidence: z.number().nullable().optional(),
  isMandatory: z.boolean().optional(),
  isAiGenerated: z.boolean().optional(),
  validationRules: FieldValidationRulesSchema.optional(),
  type: z.string().optional(),
  enum: z.array(z.string()).optional(),
  domain: z.string().optional(),
  displayName: z.record(z.string()).optional(),
});

// Tag schema for multi-select tags
export const SmartTagSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string().optional(),
});

export const SmartMetadataSchema = z.object({
  documentId: z.number().int().nullable().optional(),
  documentDomain: z.string().optional(),
  fieldProfile: z
    .object({
      domain: z.string().optional(),
      displayName: z.string().optional(),
      icon: z.string().optional(),
      requiredFields: z.array(SmartFieldSchema).optional(),
      optionalFields: z.array(SmartFieldSchema).optional(),
    })
    .optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      correspondent: z.string().optional(),
      createdDate: z.string().optional(), // ISO date string (YYYY-MM-DD)
      currentUser: z.string().optional(), // The currently logged-in user
    })
    .passthrough()
    .optional(),
  customFields: z.array(SmartFieldSchema).optional(),
  visualFields: z.array(SmartFieldSchema).optional(),
  // Tags support
  selectedTags: z.array(SmartTagSchema).optional().default([]),
  availableTags: z.array(SmartTagSchema).optional().default([]),
});

export type SmartField = z.infer<typeof SmartFieldSchema>;
export type SmartTag = z.infer<typeof SmartTagSchema>;
export type SmartMetadataContract = z.infer<typeof SmartMetadataSchema>;
