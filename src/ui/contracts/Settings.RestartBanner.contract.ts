import { z } from 'zod';

/**
 * Restart Banner Settings Contract
 *
 * Defines the shape of restart banner configuration props.
 * The banner listens for settings:restart-required events and displays a persistent notification.
 */

export const RestartBannerSettingsSchema = z.object({
  // Initial visibility state
  initiallyVisible: z.boolean().optional().default(false),

  // Reason for restart requirement
  initialReason: z.string().optional().default('Settings changed'),

  // List of changed settings
  initialChangedSettings: z.array(z.string()).optional().default([]),
});

export type RestartBannerSettings = z.infer<typeof RestartBannerSettingsSchema>;
