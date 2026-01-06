import { z } from 'zod';

export const AnnotationSchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]), // [x,y,w,h]
  comment: z.string().optional(),
  page: z.number().int().optional(),
});

export const VisualAnnotationSchema = z.object({
  documentId: z.number().int().nullable(),
  page: z.number().int().optional(),
  initialAnnotations: z.array(AnnotationSchema).optional(),
});

export type VisualAnnotationContract = z.infer<typeof VisualAnnotationSchema>;
