import { z } from 'zod';

export const BoundingBoxNormalizedSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export const ImageSchema = z.object({
  id: z.string(),
  originalSrc: z.string().url().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  thumbnailSrc: z.string().optional(),
});

export const OverlaySchema = z.object({
  id: z.string(),
  bbox: BoundingBoxNormalizedSchema,
  label: z.string().optional(),
  score: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export const ImagesSchema = z.array(ImageSchema);
export const OverlaysByImageSchema = z.record(z.array(OverlaySchema));

export type BoundingBoxNormalized = z.infer<typeof BoundingBoxNormalizedSchema>;
export type Image = z.infer<typeof ImageSchema>;
export type Overlay = z.infer<typeof OverlaySchema>;
export type Images = z.infer<typeof ImagesSchema>;
export type OverlaysByImage = z.infer<typeof OverlaysByImageSchema>;