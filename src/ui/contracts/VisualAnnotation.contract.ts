import { z } from 'zod';

/**
 * VisualAnnotation Contract
 *
 * This contract defines the structure for visual annotations in the Red Pen UI.
 * Annotations are normalized to [0,1] coordinate space for device-independence.
 *
 * Payload Mirroring:
 * - label -> maps to semantic label for Qdrant payload
 * - context.correspondentId -> mirrors correspondent_id in visual_overlays
 * - context.tagIds -> mirrors tag_ids[] in visual_overlays
 * - context.metadata -> mirrors free-form metadata in visual_overlays.payload
 */

// Single annotation with normalized coords in [0,1]
export const AnnotationSchema = z.object({
  // Required label for the annotation (e.g., "Invoice Number", "Signature")
  label: z.string().min(1),
  // ML confidence score for AI-generated annotations
  confidence: z.number().min(0).max(1).optional(),
  // Normalized bounding box coordinates (0.0 - 1.0)
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  width: z.number().min(0).max(1).optional(),
  height: z.number().min(0).max(1).optional(),
  // Optional legacy/alternate bbox representation: absolute/relative [x,y,w,h]
  bbox: z.array(z.number()).length(4).optional(),
  // User note or extracted text content
  note: z.string().optional(),
  // Whether user confirmed this annotation as correct (RLHF feedback)
  confirmed: z.boolean().optional(),
  // Context for payload mirroring (Postgres -> Qdrant)
  context: z.object({
    // Paperless-ngx correspondent ID for payload mirroring
    correspondentId: z.number().int().nullable().optional(),
    // Paperless-ngx tag IDs for payload mirroring
    tagIds: z.array(z.number().int()).optional(),
    // Page number (0-indexed)
    page: z.number().int().nonnegative().optional(),
    // Document type ID for filtering
    documentTypeId: z.number().int().nullable().optional(),
    // Free-form metadata to be mirrored into visual_overlays.payload.metadata
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
});

export const VisualAnnotationSchema = z.object({
  // Document identifier (string or number for flexibility with different backends)
  // Paperless-ngx uses numeric IDs, but we accept strings for compatibility
  documentId: z.union([z.string().min(1), z.number().int().positive()]).nullable().optional(),
  // Current page being annotated (0-indexed)
  page: z.number().int().nonnegative().optional(),
  // Allow initial empty annotations; default to empty array
  annotations: z.array(AnnotationSchema).optional().default([]),
  // GPU state for UI rendering
  gpuState: z.enum(['idle', 'checking', 'preparing', 'ready', 'error']).optional(),
});

// Reusable documentId schema for events
const DocumentIdSchema = z.union([z.string().min(1), z.number().int().positive()]).nullable().optional();

// Event payload schemas for cross-island communication
export const AnnotationCreatedEventSchema = z.object({
  type: z.literal('annotation:created'),
  documentId: DocumentIdSchema,
  page: z.number().int().nonnegative().optional(),
  annotation: AnnotationSchema,
  timestamp: z.number().optional(),
});

export const VisualSearchTriggerEventSchema = z.object({
  type: z.literal('visual-search:trigger'),
  documentId: DocumentIdSchema,
  page: z.number().int().nonnegative().optional(),
  bbox: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  }),
  timestamp: z.number().optional(),
});

export const FeedbackConfirmedEventSchema = z.object({
  type: z.literal('feedback:confirmed'),
  documentId: DocumentIdSchema,
  annotation: AnnotationSchema,
  timestamp: z.number().optional(),
});

export type Annotation = z.infer<typeof AnnotationSchema>;
export type VisualAnnotation = z.infer<typeof VisualAnnotationSchema>;
export type AnnotationCreatedEvent = z.infer<typeof AnnotationCreatedEventSchema>;
export type VisualSearchTriggerEvent = z.infer<typeof VisualSearchTriggerEventSchema>;
export type FeedbackConfirmedEvent = z.infer<typeof FeedbackConfirmedEventSchema>;

// Explicit contract type for Islands/consumers
export type VisualAnnotationContract = z.infer<typeof VisualAnnotationSchema>;

