import { z } from 'zod';

// Single annotation with normalized coords in [0,1]
export const AnnotationSchema = z.object({
  label: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
  note: z.string().optional(),
});

export const VisualAnnotationSchema = z.object({
  documentId: z.string().min(1),
  page: z.number().int().nonnegative(),
  annotations: z.array(AnnotationSchema).min(1),
});

export type Annotation = z.infer<typeof AnnotationSchema>;
export type VisualAnnotation = z.infer<
  typeof VisualAnnotationSchema
>;

