import { z } from 'zod';

/**
 * Presets Manager Contract
 *
 * Defines the shape of preset data and preset manager props.
 * Presets allow users to quickly load predefined configurations.
 */

export const PresetMetadataSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string(),
  category: z.enum(['development', 'production', 'medical', 'financial', 'legal', 'custom']).optional(),
  icon: z.string().optional(),
});

export const PresetDiffItemSchema = z.object({
  key: z.string(),
  currentValue: z.unknown().optional(),
  newValue: z.unknown(),
  category: z.string().optional(),
});

export const PresetDiffSchema = z.object({
  presetName: z.string(),
  changes: z.array(PresetDiffItemSchema),
  requiresRestart: z.boolean(),
});

export const PresetsManagerSettingsSchema = z.object({
  // Initial state
  isOpen: z.boolean().optional().default(false),
  presetName: z.string().optional(),
});

export type PresetMetadata = z.infer<typeof PresetMetadataSchema>;
export type PresetDiffItem = z.infer<typeof PresetDiffItemSchema>;
export type PresetDiff = z.infer<typeof PresetDiffSchema>;
export type PresetsManagerSettings = z.infer<typeof PresetsManagerSettingsSchema>;
