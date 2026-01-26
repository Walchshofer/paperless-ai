import { z } from 'zod';

/**
 * AIAnalysis Contract
 *
 * This contract defines the structure for the AI Analysis island.
 * Manages AI analysis buttons and status for text, visual, and chat analysis.
 */

export const AIAnalysisSchema = z.object({
  documentId: z.number().int().nullable().optional(),
  content: z.string().optional(),
  isAnalyzing: z.boolean().optional().default(false),
  analysisType: z.enum(['text', 'visual', 'chat']).nullable().optional(),
  gpuState: z.enum(['idle', 'checking', 'preparing', 'ready', 'error']).optional().default('idle'),
});

export const AIAnalysisResultSchema = z.object({
  tags: z.array(z.string()).optional(),
  correspondent: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  domain: z.string().optional(),
});

export const AIAnalysisCompletedEventSchema = z.object({
  type: z.literal('ai:analysis-completed'),
  documentId: z.number().int().nullable().optional(),
  analysisType: z.enum(['text', 'visual']),
  result: AIAnalysisResultSchema.optional(),
});

export const AIAnalysisStartedEventSchema = z.object({
  type: z.literal('ai:analysis-started'),
  documentId: z.number().int().nullable().optional(),
  analysisType: z.enum(['text', 'visual', 'chat']),
});

export type AIAnalysisContract = z.infer<typeof AIAnalysisSchema>;
export type AIAnalysisResult = z.infer<typeof AIAnalysisResultSchema>;
export type AIAnalysisCompletedEvent = z.infer<typeof AIAnalysisCompletedEventSchema>;
export type AIAnalysisStartedEvent = z.infer<typeof AIAnalysisStartedEventSchema>;
