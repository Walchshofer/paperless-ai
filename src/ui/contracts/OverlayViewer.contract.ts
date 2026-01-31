import { z } from 'zod';
import { ImagesSchema, OverlaysByImageSchema } from './VisualOverlays.contract';

export const OverlayItemSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  domain: z.string().optional(),
  color: z.string().optional(),
  isMandatory: z.boolean().optional(),
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
});

export const OverlayViewerSchema = z.object({
  documentId: z.number().int().nullable(),
  page: z.number().int().optional(),
  // Pages often start without an original URL and hydrate it later.
  originalUrl: z.string().nullable().optional(),
  pageCount: z.number().int().optional(),
  overlayMode: z.enum(['none', 'document']).optional().default('none'),
  showLegend: z.boolean().optional().default(false),
  allowSelection: z.boolean().optional().default(true),
  mode: z.enum(['view', 'draw', 'locate', 'visual-search']).optional().default('visual-search'),
  suggestions: z.array(OverlayItemSchema).optional().default([]),

  // Visual Overlays payloads (optional)
  images: ImagesSchema.optional(),
  overlaysByImage: OverlaysByImageSchema.optional(),
});

export type OverlayItem = z.infer<typeof OverlayItemSchema>;
export type OverlayViewerContract = z.infer<typeof OverlayViewerSchema>;
