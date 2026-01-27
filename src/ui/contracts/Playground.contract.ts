import { z } from 'zod';
import { ImagesSchema, OverlaysByImageSchema } from './VisualOverlays.contract';

/**
 * Playground Contract
 *
 * Zod schemas for the PlaygroundIsland component.
 * Validates props for the Visual RAG debugger.
 *
 * Architecture Reference: ticket:017.2 (Alpha-9 Protocol)
 */

// Valid collections for Alpha-9 protocol
export const CollectionEnum = z.enum(['visual_pages', 'visual_overlays']);

// Bounding box schema (normalized 0-1)
export const BoundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

// Sidecar state enum
export const SidecarStateEnum = z.enum([
  'unknown',
  'initializing',
  'ready',
  'error'
]);

// VRAM info schema
export const VramInfoSchema = z.object({
  used_mb: z.number().nonnegative().optional(),
  total_mb: z.number().nonnegative().optional(),
  percent: z.number().min(0).max(100).optional(),
});

// Sidecar status schema
export const SidecarStatusSchema = z.object({
  state: SidecarStateEnum,
  model: z.string().optional(),
  vram: VramInfoSchema.optional(),
  lastCheck: z.number().optional(),
  error: z.string().optional(),
});

// Search result schema
export const SearchResultSchema = z.object({
  docId: z.number().int(),
  score: z.number(),
  pageNum: z.number().int().optional(),
  thumbnailUrl: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Qdrant payload schema (for inspector)
export const QdrantPayloadSchema = z.object({
  doc_id: z.number().int(),
  correspondent_id: z.number().int().nullable().optional(),
  tag_ids: z.array(z.number().int()).optional(),
  created_date: z.string().optional(),
  modified_date: z.string().optional(),
  page_num: z.number().int().optional(),
  custom_fields: z.record(z.any()).optional(),
});

// Filter options schema
export const FilterOptionsSchema = z.object({
  doc_id: z.number().int().optional(),
  tag_ids: z.array(z.number().int()).optional(),
  correspondent_id: z.number().int().optional(),
});

// Playground props schema
export const PlaygroundSchema = z.object({
  // Mode: visual-debug (default) or text-debug
  mode: z.enum(['visual-debug', 'text-debug']).default('visual-debug'),

  // Collection selection
  collection: CollectionEnum.default('visual_pages'),

  // Initial sidecar status
  sidecarStatus: SidecarStatusSchema.optional(),

  // GPU state for 503 handling
  gpuState: z.enum([
    'idle',
    'checking',
    'preparing',
    'ready',
    'error'
  ]).default('idle'),

  // Filter options
  filters: FilterOptionsSchema.optional(),

  // Document ID for filtering
  documentId: z.number().int().nullable().optional(),

  // Visual overlays payloads (optional)
  images: ImagesSchema.optional(),
  overlaysByImage: OverlaysByImageSchema.optional(),
});

// Search request schema
export const SearchRequestSchema = z.object({
  image: z.string().min(1), // Base64 encoded image
  collection: CollectionEnum,
  filters: FilterOptionsSchema.optional(),
  limit: z.number().int().min(1).max(50).default(5),
});

// Search response schema
export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  scoreType: z.string().default('maxsim'),
  collectionUsed: z.string(),
  executionTimeMs: z.number(),
  queryType: z.string().default('image'),
});

// Event schemas for playground
export const PlaygroundSearchTriggerEventSchema = z.object({
  type: z.literal('playground:search-trigger'),
  image: z.string().min(1),
  collection: CollectionEnum,
  filters: FilterOptionsSchema.optional(),
  timestamp: z.number().optional(),
});

export const PlaygroundResultsReceivedEventSchema = z.object({
  type: z.literal('playground:results-received'),
  results: z.array(SearchResultSchema),
  executionTimeMs: z.number(),
  timestamp: z.number().optional(),
});

export const PlaygroundSidecarStateChangeEventSchema = z.object({
  type: z.literal('playground:sidecar-state-change'),
  state: SidecarStateEnum,
  error: z.string().optional(),
  timestamp: z.number().optional(),
});

// Export types
export type PlaygroundContract = z.infer<typeof PlaygroundSchema>;
export type SidecarStatus = z.infer<typeof SidecarStatusSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type QdrantPayload = z.infer<typeof QdrantPayloadSchema>;
export type FilterOptions = z.infer<typeof FilterOptionsSchema>;
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
