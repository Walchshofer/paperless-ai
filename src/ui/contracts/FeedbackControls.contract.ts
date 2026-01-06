import { z } from 'zod';

export const FeedbackControlsSchema = z.object({
  documentId: z.number().int().nullable(),
  components: z.array(z.object({ component: z.string(), feedback_type: z.union([z.literal('thumbs_up'), z.literal('thumbs_down')]) })),
});

export type FeedbackControlsContract = z.infer<typeof FeedbackControlsSchema>;
