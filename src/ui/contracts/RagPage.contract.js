const { z } = require('zod');

const ImageSchema = z.object({ id: z.string(), originalSrc: z.string().optional(), width: z.number().optional(), height: z.number().optional(), thumbnailSrc: z.string().optional() });
const OverlaySchema = z.object({ id: z.string(), bbox: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }), label: z.string().optional(), score: z.number().optional(), metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])).optional() });

const RagPageVmSchema = z.object({
  documentId: z.number().int().nullable(),
  original_url: z.string().nullable(),
  page_count: z.number().int().min(1),
  images: z.array(ImageSchema),
  overlaysByImage: z.record(z.array(OverlaySchema)),
});

module.exports = {
  RagPageVmSchema,
};

