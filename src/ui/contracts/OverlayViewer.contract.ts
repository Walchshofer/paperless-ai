import { z } from 'zod';

export const OverlayViewerSchema = z.object({
  documentId: z.number().int().nullable(),
  page: z.number().int().optional(),
  originalUrl: z.string().optional(),
  pageCount: z.number().int().optional(),
});

export type OverlayViewerContract = z.infer<typeof OverlayViewerSchema>;
