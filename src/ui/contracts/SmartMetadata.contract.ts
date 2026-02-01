import { z } from 'zod';

export const SmartFieldSchema = z.object({
  id: z.union([z.string(), z.number()]),
  label: z.string().optional(),
  value: z.unknown().optional(),
  overlayId: z.string().nullable().optional(),
  pageNumber: z.number().nullable().optional(),
});

export const SmartMetadataSchema = z.object({
  documentId: z.number().int().nullable().optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      correspondent: z.string().optional(),
    })
    .passthrough()
    .optional(),
  customFields: z.array(SmartFieldSchema).optional(),
});

export type SmartField = z.infer<typeof SmartFieldSchema>;
export type SmartMetadataContract = z.infer<typeof SmartMetadataSchema>;
