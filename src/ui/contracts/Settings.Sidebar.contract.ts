import { z } from 'zod';

/**
 * Contract for SettingsSidebarIsland props
 *
 * Provides category navigation and developer mode toggle for the settings page.
 */
export const SettingsSidebarSchema = z.object({
  // Initial active category
  activeCategory: z.enum([
    'overview',
    'connection',
    'ai-provider',
    'expert-models',
    'advanced',
    'developer',
    'prompts'
  ]).optional().default('overview'),

  // Developer mode initial state (can be overridden by localStorage)
  developerModeEnabled: z.boolean().optional().default(false),

  // Optional: initial last visited category from server
  lastVisitedCategory: z.string().optional(),

  // Active AI provider used for category gating
  aiProvider: z.string().optional().default('ollama'),
});

export type SettingsSidebar = z.infer<typeof SettingsSidebarSchema>;
