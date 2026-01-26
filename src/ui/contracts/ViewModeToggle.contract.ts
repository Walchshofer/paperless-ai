import { z } from 'zod';

/**
 * ViewModeToggle Contract
 *
 * This contract defines the structure for the View Mode Toggle island.
 * Manages switching between text and visual preview modes.
 */

export const ViewModeToggleSchema = z.object({
  documentId: z.number().int().nullable().optional(),
  mode: z.enum(['text', 'visual']).optional().default('text'),
  visualEnabled: z.boolean().optional().default(true),
});

export const ViewModeChangedEventSchema = z.object({
  type: z.literal('viewmode:changed'),
  mode: z.enum(['text', 'visual']),
  documentId: z.number().int().nullable().optional(),
});

export type ViewModeToggleContract = z.infer<typeof ViewModeToggleSchema>;
export type ViewModeChangedEvent = z.infer<typeof ViewModeChangedEventSchema>;
