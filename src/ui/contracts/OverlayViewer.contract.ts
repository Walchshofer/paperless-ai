import { z } from 'zod';
import { ImagesSchema, OverlaysByImageSchema } from './VisualOverlays.contract';

export const OverlayViewerSchema = z.object({
  documentId: z.number().int().nullable(),
  page: z.number().int().optional(),
  // Pages often start without an original URL and hydrate it later.
  originalUrl: z.string().nullable().optional(),
  pageCount: z.number().int().optional(),
  overlayMode: z.enum(['none', 'document']).optional().default('none'),
  showLegend: z.boolean().optional().default(false),
  allowSelection: z.boolean().optional().default(true),

  // Visual Overlays payloads (optional)
  images: ImagesSchema.optional(),
  overlaysByImage: OverlaysByImageSchema.optional(),
});

export type OverlayViewerContract = z.infer<typeof OverlayViewerSchema>;
