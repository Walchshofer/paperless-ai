import { z } from 'zod';

/**
 * ManualEditor Contract
 *
 * This contract defines the structure for the Manual Editor island.
 * Supports metadata editing, content, custom fields, and AI debug state.
 */

// Field schema for custom field rows
export const FieldSchema = z.object({
  name: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

// Extended metadata schema for manual editing
export const MetadataSchema = z.object({
  title: z.string().optional(),
  correspondent: z.string().optional(),
  documentType: z.string().optional(),
  // Additional fields can be added dynamically
}).passthrough();

export const ManualEditorSchema = z.object({
  documentId: z.number().int().nullable(),
  // Metadata for the document (title, correspondent, documentType, etc.)
  metadata: MetadataSchema.optional(),
  // Raw document content text
  content: z.string().optional(),
  // Custom field key-value pairs
  fields: z.array(FieldSchema).optional(),
  // Initial active tab
  activeTab: z.enum(['metadata', 'content', 'fields', 'ai-debug']).optional(),
  // GPU state passed from parent
  gpuState: z.enum(['idle', 'checking', 'preparing', 'ready', 'error']).optional(),
});

// Payload Ready event schema
export const PayloadReadyEventSchema = z.object({
  type: z.literal('payload:ready'),
  documentId: z.number().int().nullable().optional(),
  metadata: MetadataSchema.optional(),
  content: z.string().optional(),
  fields: z.array(FieldSchema).optional(),
  timestamp: z.number().optional(),
});

// Sync Failed event schema
export const SyncFailedEventSchema = z.object({
  type: z.literal('sync:failed'),
  documentId: z.number().int().nullable().optional(),
  error: z.string(),
  timestamp: z.number().optional(),
});

export type Field = z.infer<typeof FieldSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type ManualEditorContract = z.infer<typeof ManualEditorSchema>;
export type PayloadReadyEvent = z.infer<typeof PayloadReadyEventSchema>;
export type SyncFailedEvent = z.infer<typeof SyncFailedEventSchema>;
