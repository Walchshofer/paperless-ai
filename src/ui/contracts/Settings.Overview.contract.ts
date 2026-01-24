import { z } from 'zod';

/**
 * Contract for OverviewDashboardIsland props
 *
 * Displays summary cards for current configuration and provides quick actions
 * to navigate to specific settings categories.
 */
export const OverviewDashboardSchema = z.object({
  // Connection summary
  connection: z.object({
    paperlessApiUrl: z.string().optional(),
    isConnected: z.boolean().optional().default(false),
    lastTestAt: z.string().optional(), // ISO timestamp
  }).optional(),

  // AI Provider summary
  aiProvider: z.object({
    provider: z.enum(['openai', 'ollama', 'custom', 'azure']).optional(),
    model: z.string().optional(),
    tokenLimit: z.number().int().optional(),
  }).optional(),

  // Expert Models summary
  expertModels: z.object({
    enabled: z.boolean().optional().default(false),
    medicalVisionModel: z.string().optional(),
    financialAnalysisModel: z.string().optional(),
    legalVisionModel: z.string().optional(),
  }).optional(),

  // Advanced highlights
  advanced: z.object({
    expertPipelineEnabled: z.boolean().optional().default(false),
    activateTagging: z.boolean().optional().default(false),
    activateCorrespondents: z.boolean().optional().default(false),
    scanInterval: z.string().optional(),
  }).optional(),
});

export type OverviewDashboard = z.infer<typeof OverviewDashboardSchema>;
