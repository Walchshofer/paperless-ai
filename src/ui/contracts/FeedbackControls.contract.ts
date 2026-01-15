import { z } from 'zod';

export const FeedbackControlsSchema = z.object({
  documentId: z.number().int().nullable().optional().default(null),
  // existing feedback events recorded (backwards compat)
  components: z.array(
    z.object({
      component: z.string(),
      feedback_type: z.union([z.literal('thumbs_up'), z.literal('thumbs_down')]),
    })
  ).optional().default([]),
  // components available to render controls for (e.g. ['tags','correspondent'])
  availableComponents: z.array(z.string()).optional().default(['tags']),
});

export type FeedbackControlsContract = z.infer<typeof FeedbackControlsSchema>;
