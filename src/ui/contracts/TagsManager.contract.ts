import { z } from 'zod';

/**
 * TagsManager Contract
 *
 * This contract defines the structure for the Tags Manager island.
 * Manages AI-suggested tags, current tags, and tag operations.
 */

export const TagSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string().optional(),
});

export const TagsManagerSchema = z.object({
  documentId: z.number().int().nullable().optional(),
  currentTags: z.array(TagSchema).optional().default([]),
  suggestedTags: z.array(TagSchema).optional().default([]),
  availableTags: z.array(TagSchema).optional().default([]),
  isSaving: z.boolean().optional().default(false),
});

export const TagsUpdatedEventSchema = z.object({
  type: z.literal('tags:updated'),
  documentId: z.number().int().nullable().optional(),
  currentTags: z.array(z.number().int()),
  action: z.enum(['add', 'remove', 'accept-suggestion', 'save']),
});

export const TagsSuggestionsReceivedEventSchema = z.object({
  type: z.literal('tags:suggestions-received'),
  documentId: z.number().int().nullable().optional(),
  suggestedTags: z.array(TagSchema),
});

export type Tag = z.infer<typeof TagSchema>;
export type TagsManagerContract = z.infer<typeof TagsManagerSchema>;
export type TagsUpdatedEvent = z.infer<typeof TagsUpdatedEventSchema>;
export type TagsSuggestionsReceivedEvent = z.infer<typeof TagsSuggestionsReceivedEventSchema>;
