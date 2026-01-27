import { z } from 'zod';

export const SettingsSchema = z.object({
  PAPERLESS_API_URL: z.string().url().optional(),
  PAPERLESS_API_TOKEN: z.string().optional(),
  PAPERLESS_USERNAME: z.string().optional(),
  AI_PROVIDER: z.enum(['openai', 'ollama', 'custom', 'azure']).optional(),
  PAPERLESS_OPENAI_API_KEY: z.string().optional(),
  PAPERLESS_OPENAI_MODEL: z.string().optional(),
  OLLAMA_API_URL: z.string().optional(),
  OLLAMA_MODEL: z.string().optional(),
  TOKEN_LIMIT: z.union([z.string(), z.number()]).optional(),
  RESPONSE_TOKENS: z.union([z.string(), z.number()]).optional(),
  TAGS: z.array(z.string()).optional(),
  PROMPT_TAGS: z.array(z.string()).optional(),
  PAPERLESS_AI_VERSION: z.string().optional(),
  // allow extra keys for backward/forward compatibility
}).catchall(z.any());

export const SettingsPageVmSchema = z.object({
  page: z.literal('settings'),
  version: z.string().optional(),
  settings: SettingsSchema,
  success: z.string().optional(),
  settingsError: z.string().optional(),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type SettingsPageVm = z.infer<typeof SettingsPageVmSchema>;