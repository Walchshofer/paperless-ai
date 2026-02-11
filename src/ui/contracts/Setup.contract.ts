import { z } from 'zod';

/**
 * Setup Onboarding Wizard Contract
 * 
 * Defines the shape of the View Model for the initial setup page.
 */

export const SetupVmSchema = z.object({
  page: z.literal('setup'),
  PAPERLESS_AI_VERSION: z.string().optional(),
  
  // Connection Settings
  PAPERLESS_API_URL: z.string().optional(),
  PAPERLESS_API_TOKEN: z.string().optional(),
  PAPERLESS_USERNAME: z.string().optional(),
  
  // AI Provider Settings
  AI_PROVIDER: z.enum(['openai', 'ollama', 'custom', 'azure']).optional().default('openai'),
  PAPERLESS_OPENAI_API_KEY: z.string().optional(),
  PAPERLESS_OPENAI_MODEL: z.string().optional().default('gpt-4o-mini'),
  OLLAMA_API_URL: z.string().optional().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().optional(),
  
  // Ollama Specific Limits
  OLLAMA_CONTEXT_WINDOW: z.union([z.string(), z.number()]).optional(),
  OLLAMA_MAX_RESPONSE_TOKENS: z.union([z.string(), z.number()]).optional(),
  OLLAMA_VISION_CONTEXT_WINDOW: z.union([z.string(), z.number()]).optional(),
  OLLAMA_VISION_MAX_RESPONSE_TOKENS: z.union([z.string(), z.number()]).optional(),
  OLLAMA_EXPERT_CONTEXT_WINDOW: z.union([z.string(), z.number()]).optional(),
  OLLAMA_EXPERT_MAX_RESPONSE_TOKENS: z.union([z.string(), z.number()]).optional(),
  TRANSLATION_CONTEXT_WINDOW: z.union([z.string(), z.number()]).optional(),
  TRANSLATION_MAX_TOKENS: z.union([z.string(), z.number()]).optional(),
  
  // Advanced Settings
  TOKEN_LIMIT: z.union([z.string(), z.number()]).optional().default(128000),
  RESPONSE_TOKENS: z.union([z.string(), z.number()]).optional().default(1000),
  SCAN_INTERVAL: z.string().optional().default('*/30 * * * *'),
  SYSTEM_PROMPT: z.string().optional(),
  USE_EXISTING_DATA: z.enum(['yes', 'no']).optional().default('no'),
  PIPELINE_TAG_REPLACE: z.enum(['yes', 'no']).optional().default('no'),
  PROCESS_PREDEFINED_DOCUMENTS: z.enum(['yes', 'no']).optional().default('no'),
  TAGS: z.array(z.string()).optional().default([]),
  ADD_AI_PROCESSED_TAG: z.enum(['yes', 'no']).optional().default('no'),
  AI_PROCESSED_TAG_NAME: z.string().optional().default('ai-processed'),
  USE_PROMPT_TAGS: z.enum(['yes', 'no']).optional().default('no'),
  PROMPT_TAGS: z.array(z.string()).optional().default([]),
  DISABLE_AUTOMATIC_PROCESSING: z.enum(['yes', 'no']).optional().default('no'),
  
  // AI Functions
  ACTIVATE_TAGGING: z.enum(['yes', 'no']).optional().default('yes'),
  ACTIVATE_CORRESPONDENTS: z.enum(['yes', 'no']).optional().default('yes'),
  ACTIVATE_DOCUMENT_TYPE: z.enum(['yes', 'no']).optional().default('yes'),
  ACTIVATE_TITLE: z.enum(['yes', 'no']).optional().default('yes'),
  ACTIVATE_CUSTOM_FIELDS: z.enum(['yes', 'no']).optional().default('yes'),
  CUSTOM_FIELDS: z.string().optional().default('{"custom_fields":[]}'),
  
  // Azure
  AZURE_ENDPOINT: z.string().optional(),
  AZURE_API_KEY: z.string().optional(),
  AZURE_DEPLOYMENT_NAME: z.string().optional(),
  AZURE_API_VERSION: z.string().optional(),
  
  // Custom
  CUSTOM_BASE_URL: z.string().optional(),
  CUSTOM_API_KEY: z.string().optional(),
  CUSTOM_MODEL: z.string().optional(),
  
  // Qdrant
  QDRANT_HOST: z.string().optional().default('qdrant'),
  QDRANT_PORT: z.union([z.string(), z.number()]).optional().default('6333'),
  QDRANT_API_KEY: z.string().optional(),
  VECTOR_STORE: z.string().optional().default('qdrant'),
});

export type SetupVm = z.infer<typeof SetupVmSchema>;
