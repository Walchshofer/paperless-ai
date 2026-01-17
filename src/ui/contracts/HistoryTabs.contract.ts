import { z } from 'zod';

/**
 * HistoryTabs Contract - Alpha-9 Protocol
 *
 * Defines the contract for HistoryTabsIsland including:
 * - Document content and metadata
 * - Visual search result schema
 * - MaxSim score format
 *
 * Architecture Reference: ticket:008.2 (Zod Contract)
 */

// Tag schema
export const TagSchema = z.object({
  id: z.number().int(),
  name: z.string()
});

// Metadata schema for Hybrid SOT
export const MetadataSchema = z.object({
  correspondent: z.string().optional(),
  correspondentId: z.number().int().optional(),
  tags: z.array(TagSchema).optional(),
  documentType: z.string().optional(),
  created: z.string().optional(),
  modified: z.string().optional()
});

// Visual search result schema (MaxSim)
export const SimilarResultSchema = z.object({
  docId: z.number().int(),
  pageNum: z.number().int().optional(),
  score: z.number().min(0).max(1),
  thumbnailUrl: z.string().url().optional()
});

// Active filters schema
export const ActiveFiltersSchema = z.object({
  correspondentId: z.number().int().optional(),
  tagIds: z.array(z.number().int()).optional()
});

// Main HistoryTabs contract
export const HistoryTabsSchema = z.object({
  documentId: z.number().int().nullable(),
  content: z.string().optional(),
  metadata: MetadataSchema.optional()
});

// Search response schema (Alpha-9)
export const SearchResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(SimilarResultSchema),
  collectionUsed: z.enum(['visual_pages', 'visual_overlays']),
  scoreType: z.string().default('maxsim'),
  executionTimeMs: z.number().optional(),
  maxsimScoreMean: z.number().optional()
});

// Export types
export type TagInfo = z.infer<typeof TagSchema>;
export type MetadataInfo = z.infer<typeof MetadataSchema>;
export type SimilarResult = z.infer<typeof SimilarResultSchema>;
export type ActiveFilters = z.infer<typeof ActiveFiltersSchema>;
export type HistoryTabsContract = z.infer<typeof HistoryTabsSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
