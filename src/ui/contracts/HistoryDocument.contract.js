const { z } = require('zod');

const TagObjectSchema = z.object({
  id: z.coerce.number().int(),
  name: z.string(),
});

const MetadataSchema = z.object({
  correspondent: z.string().nullable().optional(),
  correspondentId: z.coerce.number().int().nullable().optional(),
  tags: z.array(TagObjectSchema).optional(),
  documentType: z.string().nullable().optional(),
  created: z.string().nullable().optional(),
  modified: z.string().nullable().optional(),
});

const HistoryDocumentVmSchema = z.object({
  documentId: z.coerce.number().int(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  tagObjects: z.array(TagObjectSchema),
  metadata: MetadataSchema,
  correspondent: z.string(),
  correspondentId: z.coerce.number().int().nullable(),
  documentType: z.string().nullable(),
  createdAt: z.string(),
  modifiedAt: z.string().nullable(),
  paperlessUrl: z.string(),
  original_url: z.string().nullable(),
  page_count: z.coerce.number().int().min(1),
  images: z.array(z.unknown()),
  overlaysByImage: z.record(z.unknown()),
});

module.exports = {
  HistoryDocumentVmSchema,
};

