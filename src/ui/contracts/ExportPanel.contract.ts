import { z } from 'zod';

export const ExportPanelSchema = z.object({
  documentId: z.number().nullable().optional(),
});

export type ExportPanelContract = z.infer<typeof ExportPanelSchema>;
