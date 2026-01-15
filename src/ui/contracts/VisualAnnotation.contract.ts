import { z } from 'zod';

// Single annotation with normalized coords in [0,1]
export const AnnotationSchema = z.object({
  label: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  width: z.number().min(0).max(1).optional(),
  height: z.number().min(0).max(1).optional(),
  // Optional legacy/alternate bbox representation: absolute/relative [x,y,w,h]
  bbox: z.array(z.number()).length(4).optional(),
  note: z.string().optional(),
  // Context for payload mirroring (Postgres -> Qdrant)
  context: z.object({
    correspondentId: z.number().int().nullable().optional(),
    tagIds: z.array(z.number().int()).optional(),
    page: z.number().int().nonnegative().optional(),
    // Free-form metadata to be mirrored into visual_overlays.payload.metadata
    metadata: z.record(z.any()).optional(),
  }).optional(),
});

export const VisualAnnotationSchema = z.object({
  documentId: z.string().min(1),
  page: z.number().int().nonnegative().optional(),
  // allow initial empty annotations; default to empty array
  annotations: z.array(AnnotationSchema).optional().default([]),
});

export type Annotation = z.infer<typeof AnnotationSchema>;
export type VisualAnnotation = z.infer<
  typeof VisualAnnotationSchema
>;

// Explicit contract type for Islands/consumers
export type VisualAnnotationContract = z.infer<typeof VisualAnnotationSchema>;

