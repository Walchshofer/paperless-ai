import { z } from 'zod';

// Smart metadata field values are typically scalar (string/number/boolean) or small arrays of strings
export const SmartFieldValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

export const SmartFieldSchema = z.object({
  id: z.union([z.string(), z.number()]),
  label: z.string().optional(),
  value: SmartFieldValueSchema.optional(),
  overlayId: z.string().nullable().optional(),
  pageNumber: z.number().nullable().optional(),
});

// Tag schema for multi-select tags
export const SmartTagSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string().optional(),
});

export const SmartMetadataSchema = z.object({
  documentId: z.number().int().nullable().optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      correspondent: z.string().optional(),
      createdDate: z.string().optional(), // ISO date string (YYYY-MM-DD)
    })
    .passthrough()
    .optional(),
  customFields: z.array(SmartFieldSchema).optional(),
});

export type SmartField = z.infer<typeof SmartFieldSchema>;
export type SmartMetadataContract = z.infer<typeof SmartMetadataSchema>;
