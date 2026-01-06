import { z } from 'zod';

export const HistoryTabsSchema = z.object({
  documentId: z.number().int().nullable(),
  content: z.string().optional(),
});

export type HistoryTabsContract = z.infer<typeof HistoryTabsSchema>;
