const { z } = require('zod');

const RagPageVmSchema = z.object({
  documentId: z.number().int().nullable(),
  original_url: z.string().nullable(),
  page_count: z.number().int().min(1),
  images: z.array(z.unknown()),
  overlaysByImage: z.record(z.unknown()),
});

module.exports = {
  RagPageVmSchema,
};

