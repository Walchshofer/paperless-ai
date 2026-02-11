import { z } from 'zod';

export const SettingsHeaderSchema = z.object({
  apiKey: z.string(),
  isAdmin: z.boolean().default(false)
});

export type SettingsHeaderProps = z.infer<typeof SettingsHeaderSchema>;
