const express = require('express');
const router = express.Router();
const setupService = require('../services/setupService.js');
const paperlessService = require('../services/paperlessService.js');
const configFile = require('../config/config.js');
const config = require('../config/config.js');
const logger = require('../services/logger');
const fs = require('fs').promises;
const path = require('path');
// Load runtime env persisted by setup (renamed to data/runtime.env)
require('dotenv').config({ path: '../data/runtime.env' });

// Helper functions for model limits
const parseOllamaModelLimits = (value) => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    logger.warn('[SETTINGS] Failed to parse OLLAMA_MODEL_LIMITS_JSON', { error: error.message });
    return {};
  }
};

const findModelLimitKey = (limits, modelName) => {
  if (!limits || !modelName) return null;
  const normalized = String(modelName).toLowerCase();
  return Object.keys(limits).find((key) => key.toLowerCase() === normalized) || null;
};

const resolveModelLimit = (limits, modelName, kind) => {
  const key = findModelLimitKey(limits, modelName);
  if (!key) return {};
  const entry = limits[key];
  if (!entry || typeof entry !== 'object') return {};
  const candidate = entry[kind] && typeof entry[kind] === 'object' ? entry[kind] : entry;
  return candidate && typeof candidate === 'object' ? candidate : {};
};

const parseLimitInput = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const upsertModelLimit = (limits, modelName, kind, contextWindowInput, maxResponseTokensInput) => {
  if (!limits || !modelName || !kind) return;
  const trimmed = String(modelName).trim();
  if (!trimmed) return;

  const existingKey = findModelLimitKey(limits, trimmed);
  const key = existingKey || trimmed;
  const existingEntry = limits[key];
  const nextEntry = existingEntry && typeof existingEntry === 'object' ? { ...existingEntry } : {};
  const kindEntry = nextEntry[kind] && typeof nextEntry[kind] === 'object' ? { ...nextEntry[kind] } : {};

  const contextWindow = parseLimitInput(contextWindowInput);
  const maxResponseTokens = parseLimitInput(maxResponseTokensInput);

  if (contextWindow === null) {
    delete kindEntry.contextWindow;
  } else {
    kindEntry.contextWindow = contextWindow;
  }

  if (maxResponseTokens === null) {
    delete kindEntry.maxResponseTokens;
  } else {
    kindEntry.maxResponseTokens = maxResponseTokens;
  }

  if (Object.keys(kindEntry).length === 0) {
    delete nextEntry[kind];
  } else {
    nextEntry[kind] = kindEntry;
  }

  if (Object.keys(nextEntry).length === 0) {
    delete limits[key];
  } else {
    limits[key] = nextEntry;
  }
};

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').filter(Boolean).map(item => item.trim());
  return [];
};

/**
 * @swagger
 * /settings:
 *   get:
 *     summary: Application settings page
 *     description: |
 *       Renders the application settings page where users can modify configuration
 *       after initial setup.
 *
 *       This page allows administrators to update connections to Paperless-ngx,
 *       AI provider settings, processing parameters, feature toggles, and custom fields.
 *       The interface provides validation for connection settings and displays the current
 *       configuration values.
 *
 *       Changes made on this page require application restart to take full effect.
 *     tags:
 *       - Navigation
 *       - Setup
 *       - System
 *     responses:
 *       200:
 *         description: Settings page rendered successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML content of the application settings page
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/settings', async (req, res) => {
  let showErrorCheckSettings = false;
  const isConfigured = await setupService.isConfigured();
  if(!isConfigured && process.env.PAPERLESS_AI_INITIAL_SETUP === 'yes') {
    showErrorCheckSettings = true;
  }
  const modelLimits = (config?.ollama?.modelLimits && typeof config.ollama.modelLimits === 'object')
    ? config.ollama.modelLimits
    : parseOllamaModelLimits(process.env.OLLAMA_MODEL_LIMITS_JSON);
  const resolveLimitValue = (modelName, kind, field) => {
    const resolved = resolveModelLimit(modelLimits, modelName, kind);
    const value = resolved ? resolved[field] : undefined;
    return value === undefined || value === null ? '' : value;
  };

  const medicalVisionModel = process.env.MEDICAL_VISION_MODEL || 'qwen3-vl:8b';
  const medicalAnalysisModel = process.env.MEDICAL_ANALYSIS_MODEL || 'medtext-llama3';
  const medicalRadiologyModel = process.env.MEDICAL_RADIOLOGY_MODEL || 'llava-med-v1.6';
  const plannerModel = process.env.PLANNER_MODEL ||
    process.env.OLLAMA_PLANNER_MODEL ||
    process.env.OLLAMA_VISION_MODEL ||
    'qwen3-vl:8b';
  const routerModel = process.env.ROUTER_MODEL ||
    process.env.OLLAMA_ROUTER_MODEL ||
    plannerModel ||
    'qwen3-vl:8b';
  const orchestratorModel = process.env.ORCHESTRATOR_MODEL || 'nemotron-orchestrator:8b';
  const financialVisionModel = process.env.FINANCIAL_VISION_MODEL || 'llm-pro-finance-8b';
  const financialAnalysisModel = process.env.FINANCIAL_ANALYSIS_MODEL || 'fino1-8b';
  const financialReasoningModel = process.env.FINANCIAL_REASONING_MODEL || process.env.FINANCIAL_ANALYSIS_MODEL || 'llm-pro-finance-8b';
  const financialVatExpertModel = process.env.FINANCIAL_VAT_EXPERT || 'llm-pro-finance-8b';
  const legalVisionModel = process.env.LEGAL_VISION_MODEL || 'qwen3-vl:8b';
  const legalAnalysisModel = process.env.LEGAL_ANALYSIS_MODEL || 'gpt-oss';
  const legalOrchestratorModel = process.env.LEGAL_ORCHESTRATOR_MODEL || orchestratorModel;
  let settingsConfig = {
    PAPERLESS_API_URL: (process.env.PAPERLESS_API_URL || 'http://localhost:8000').replace(/\/api$/, ''),
    PAPERLESS_API_TOKEN: process.env.PAPERLESS_API_TOKEN || '',
    PAPERLESS_USERNAME: process.env.PAPERLESS_USERNAME || '',
    AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
    PAPERLESS_OPENAI_API_KEY: process.env.PAPERLESS_OPENAI_API_KEY || '',
    PAPERLESS_OPENAI_MODEL: process.env.PAPERLESS_OPENAI_MODEL || 'gpt-4o-mini',
    OLLAMA_API_URL: process.env.OLLAMA_API_URL || 'http://localhost:11434',
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'sauerkraut-llama3.1:8b',
    OLLAMA_CONTEXT_WINDOW: process.env.OLLAMA_CONTEXT_WINDOW || '',
    OLLAMA_MAX_RESPONSE_TOKENS: process.env.OLLAMA_MAX_RESPONSE_TOKENS || '',
    OLLAMA_VISION_CONTEXT_WINDOW: process.env.OLLAMA_VISION_CONTEXT_WINDOW || '',
    OLLAMA_VISION_MAX_RESPONSE_TOKENS: process.env.OLLAMA_VISION_MAX_RESPONSE_TOKENS || '',
    OLLAMA_EXPERT_CONTEXT_WINDOW: process.env.OLLAMA_EXPERT_CONTEXT_WINDOW || '',
    OLLAMA_EXPERT_MAX_RESPONSE_TOKENS: process.env.OLLAMA_EXPERT_MAX_RESPONSE_TOKENS || '',
    TRANSLATION_CONTEXT_WINDOW: process.env.TRANSLATION_CONTEXT_WINDOW || '',
    TRANSLATION_MAX_TOKENS: process.env.TRANSLATION_MAX_TOKENS || '',
    EXPERT_PIPELINE_ENABLED: process.env.EXPERT_PIPELINE_ENABLED || 'yes',
    MEDICAL_VISION_MODEL: medicalVisionModel,
    MEDICAL_ANALYSIS_MODEL: medicalAnalysisModel,
    MEDICAL_RADIOLOGY_MODEL: medicalRadiologyModel,
    PLANNER_MODEL: plannerModel,
    ROUTER_MODEL: routerModel,
    ORCHESTRATOR_MODEL: orchestratorModel,
    FINANCIAL_VISION_MODEL: financialVisionModel,
    FINANCIAL_ANALYSIS_MODEL: financialAnalysisModel,
    FINANCIAL_REASONING_MODEL: financialReasoningModel,
    FINANCIAL_VAT_EXPERT: financialVatExpertModel,
    LEGAL_VISION_MODEL: legalVisionModel,
    LEGAL_ANALYSIS_MODEL: legalAnalysisModel,
    LEGAL_ORCHESTRATOR_MODEL: legalOrchestratorModel,
    PLANNER_CONTEXT_WINDOW: resolveLimitValue(plannerModel, 'planner', 'contextWindow'),
    PLANNER_MAX_RESPONSE_TOKENS: resolveLimitValue(plannerModel, 'planner', 'maxResponseTokens'),
    ROUTER_CONTEXT_WINDOW: resolveLimitValue(routerModel, 'expert', 'contextWindow'),
    ROUTER_MAX_RESPONSE_TOKENS: resolveLimitValue(routerModel, 'expert', 'maxResponseTokens'),
    ORCHESTRATOR_CONTEXT_WINDOW: resolveLimitValue(orchestratorModel, 'expert', 'contextWindow'),
    ORCHESTRATOR_MAX_RESPONSE_TOKENS: resolveLimitValue(orchestratorModel, 'expert', 'maxResponseTokens'),
    MEDICAL_VISION_CONTEXT_WINDOW: resolveLimitValue(medicalVisionModel, 'vision', 'contextWindow'),
    MEDICAL_VISION_MAX_RESPONSE_TOKENS: resolveLimitValue(medicalVisionModel, 'vision', 'maxResponseTokens'),
    MEDICAL_ANALYSIS_CONTEXT_WINDOW: resolveLimitValue(medicalAnalysisModel, 'expert', 'contextWindow'),
    MEDICAL_ANALYSIS_MAX_RESPONSE_TOKENS: resolveLimitValue(medicalAnalysisModel, 'expert', 'maxResponseTokens'),
    MEDICAL_RADIOLOGY_CONTEXT_WINDOW: resolveLimitValue(medicalRadiologyModel, 'vision', 'contextWindow'),
    MEDICAL_RADIOLOGY_MAX_RESPONSE_TOKENS: resolveLimitValue(medicalRadiologyModel, 'vision', 'maxResponseTokens'),
    FINANCIAL_VISION_CONTEXT_WINDOW: resolveLimitValue(financialVisionModel, 'vision', 'contextWindow'),
    FINANCIAL_VISION_MAX_RESPONSE_TOKENS: resolveLimitValue(financialVisionModel, 'vision', 'maxResponseTokens'),
    FINANCIAL_ANALYSIS_CONTEXT_WINDOW: resolveLimitValue(financialAnalysisModel, 'expert', 'contextWindow'),
    FINANCIAL_ANALYSIS_MAX_RESPONSE_TOKENS: resolveLimitValue(financialAnalysisModel, 'expert', 'maxResponseTokens'),
    FINANCIAL_VAT_EXPERT_CONTEXT_WINDOW: resolveLimitValue(financialVatExpertModel, 'expert', 'contextWindow'),
    FINANCIAL_VAT_EXPERT_MAX_RESPONSE_TOKENS: resolveLimitValue(financialVatExpertModel, 'expert', 'maxResponseTokens'),
    LEGAL_VISION_CONTEXT_WINDOW: resolveLimitValue(legalVisionModel, 'vision', 'contextWindow'),
    LEGAL_VISION_MAX_RESPONSE_TOKENS: resolveLimitValue(legalVisionModel, 'vision', 'maxResponseTokens'),
    LEGAL_ANALYSIS_CONTEXT_WINDOW: resolveLimitValue(legalAnalysisModel, 'expert', 'contextWindow'),
    LEGAL_ANALYSIS_MAX_RESPONSE_TOKENS: resolveLimitValue(legalAnalysisModel, 'expert', 'maxResponseTokens'),
    LEGAL_ORCHESTRATOR_CONTEXT_WINDOW: resolveLimitValue(legalOrchestratorModel, 'expert', 'contextWindow'),
    LEGAL_ORCHESTRATOR_MAX_RESPONSE_TOKENS: resolveLimitValue(legalOrchestratorModel, 'expert', 'maxResponseTokens'),
    SCAN_INTERVAL: process.env.SCAN_INTERVAL || '*/30 * * * *',
    SYSTEM_PROMPT: process.env.SYSTEM_PROMPT || '',
    PROCESS_PREDEFINED_DOCUMENTS: process.env.PROCESS_PREDEFINED_DOCUMENTS || 'no',

    TOKEN_LIMIT: process.env.TOKEN_LIMIT || 128000,
    RESPONSE_TOKENS: process.env.RESPONSE_TOKENS || 1000,
    TAGS: normalizeArray(process.env.TAGS),
    ADD_AI_PROCESSED_TAG: process.env.ADD_AI_PROCESSED_TAG || 'no',
    AI_PROCESSED_TAG_NAME: process.env.AI_PROCESSED_TAG_NAME || 'ai-processed',
    USE_PROMPT_TAGS: process.env.USE_PROMPT_TAGS || 'no',
    PROMPT_TAGS: normalizeArray(process.env.PROMPT_TAGS),
    PAPERLESS_AI_VERSION: configFile.PAPERLESS_AI_VERSION || ' ',
    PROCESS_ONLY_NEW_DOCUMENTS: process.env.PROCESS_ONLY_NEW_DOCUMENTS || ' ',
    USE_EXISTING_DATA: process.env.USE_EXISTING_DATA || 'no',
    CUSTOM_API_KEY: process.env.CUSTOM_API_KEY || '',
    CUSTOM_BASE_URL: process.env.CUSTOM_BASE_URL || '',
    CUSTOM_MODEL: process.env.CUSTOM_MODEL || '',
    AZURE_ENDPOINT: process.env.AZURE_ENDPOINT|| '',
    AZURE_API_KEY: process.env.AZURE_API_KEY || '',
    AZURE_DEPLOYMENT_NAME: process.env.AZURE_DEPLOYMENT_NAME || '',
    AZURE_API_VERSION: process.env.AZURE_API_VERSION || '',
    RESTRICT_TO_EXISTING_TAGS: process.env.RESTRICT_TO_EXISTING_TAGS || 'no',
    PIPELINE_TAG_REPLACE: process.env.PIPELINE_TAG_REPLACE || 'no',
    RESTRICT_TO_EXISTING_CORRESPONDENTS: process.env.RESTRICT_TO_EXISTING_CORRESPONDENTS || 'no',
    RESTRICT_TO_EXISTING_DOCUMENT_TYPES: process.env.RESTRICT_TO_EXISTING_DOCUMENT_TYPES || 'no',
    EXTERNAL_API_ENABLED: process.env.EXTERNAL_API_ENABLED || 'no',
    EXTERNAL_API_URL: process.env.EXTERNAL_API_URL || '',
    EXTERNAL_API_METHOD: process.env.EXTERNAL_API_METHOD || 'GET',
    EXTERNAL_API_HEADERS: process.env.EXTERNAL_API_HEADERS || '{}',
    EXTERNAL_API_BODY: process.env.EXTERNAL_API_BODY || '{}',
    EXTERNAL_API_TIMEOUT: process.env.EXTERNAL_API_TIMEOUT || '5000',
    EXTERNAL_API_TRANSFORM: process.env.EXTERNAL_API_TRANSFORM || '',
    // Test/CI: allow disabling external GitHub fetches to avoid flaky rate-limited requests
    DISABLE_GITHUB_FETCH: process.env.DISABLE_GITHUB_FETCH || 'no'
  };

  if (isConfigured) {
    const savedConfig = await setupService.loadConfig();
    if (savedConfig.PAPERLESS_API_URL) {
      savedConfig.PAPERLESS_API_URL = savedConfig.PAPERLESS_API_URL.replace(/\/api$/, '');
    }

    savedConfig.TAGS = normalizeArray(savedConfig.TAGS);
    savedConfig.PROMPT_TAGS = normalizeArray(savedConfig.PROMPT_TAGS);

    settingsConfig = { ...settingsConfig, ...savedConfig };
  }

  // Debug-output
  console.log('Current config TAGS:', settingsConfig.TAGS);
  console.log('Current config PROMPT_TAGS:', settingsConfig.PROMPT_TAGS);
  const version = configFile.PAPERLESS_AI_VERSION || ' ';
  const vm = {
    page: 'settings',
    version,
    settings: settingsConfig,
    success: isConfigured ? 'The application is already configured. You can update the configuration below.' : undefined,
    settingsError: showErrorCheckSettings ? 'Please check your settings. Something is not working correctly.' : undefined
  };

  // Render using the view-model contract: templates must reference only `vm.*` fields
  res.render('settings', { vm });
});

/**
 * @swagger
 * /settings:
 *   post:
 *     summary: Update application settings
 *     description: |
 *       Updates the configuration settings of the Paperless-AI application after initial setup.
 *       This endpoint allows administrators to modify connections to Paperless-ngx,
 *       AI provider settings, processing parameters, and feature toggles.
 *
 *       Changes made through this endpoint are applied immediately and affect all future
 *       document processing operations.
 *     tags:
 *       - System
 *       - Setup
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paperlessUrl:
 *                 type: string
 *                 description: URL of the Paperless-ngx instance
 *                 example: "https://paperless.example.com"
 *               paperlessToken:
 *                 type: string
 *                 description: API token for Paperless-ngx access
 *                 example: "abc123def456"
 *               paperlessUsername:
 *                 type: string
 *                 description: Username for Paperless-ngx (alternative to token authentication)
 *                 example: "admin"
 *               aiProvider:
 *                 type: string
 *                 description: Selected AI provider for document analysis
 *                 enum: ["openai", "ollama", "custom", "azure"]
 *                 example: "openai"
 *               openaiKey:
 *                 type: string
 *                 description: API key for OpenAI (required when aiProvider is 'openai')
 *                 example: "sk-abc123def456"
 *               openaiModel:
 *                 type: string
 *                 description: OpenAI model to use for analysis
 *                 example: "gpt-4"
 *               ollamaUrl:
 *                 type: string
 *                 description: URL for Ollama API (required when aiProvider is 'ollama')
 *                 example: "http://localhost:11434"
 *               ollamaModel:
 *                 type: string
 *                 description: Ollama model to use for analysis
 *                 example: "sauerkraut-llama3.1:8b"
 *               customApiKey:
 *                 type: string
 *                 description: API key for custom LLM provider
 *                 example: "api-key-123"
 *               customBaseUrl:
 *                 type: string
 *                 description: Base URL for custom LLM provider
 *                 example: "https://api.customllm.com"
 *               customModel:
 *                 type: string
 *                 description: Model name for custom LLM provider
 *                 example: "custom-model"
 *               scanInterval:
 *                 type: number
 *                 description: Interval in minutes for scanning new documents
 *                 example: 15
 *               systemPrompt:
 *                 type: string
 *                 description: Custom system prompt for document analysis
 *                 example: "Extract key information from the following document..."
 *               showTags:
 *                 type: boolean
 *                 description: Whether to show tags in the UI
 *                 example: true
 *               tokenLimit:
 *                 type: integer
 *                 description: The maximum number of tokens th AI can handle
 *                 example: 128000
 *               responseTokens:
 *                 type: integer
 *                 description: The approx. amount of tokens required for the response
 *                 example: 1000
 *               tags:
 *                 type: string
 *                 description: Comma-separated list of tags to use for filtering
 *                 example: "Invoice,Receipt,Contract"
 *               aiProcessedTag:
 *                 type: boolean
 *                 description: Whether to add a tag for AI-processed documents
 *                 example: true
 *               aiTagName:
 *                 type: string
 *                 description: Tag name to use for AI-processed documents
 *                 example: "AI-Processed"
 *               usePromptTags:
 *                 type: boolean
 *                 description: Whether to use tags in prompts
 *                 example: true
 *               promptTags:
 *                 type: string
 *                 description: Comma-separated list of tags to use in prompts
 *                 example: "Invoice,Receipt"
 *               useExistingData:
 *                 type: boolean
 *                 description: Whether to use existing data from a previous setup
 *                 example: false
 *               activateTagging:
 *                 type: boolean
 *                 description: Enable AI-based tag suggestions
 *                 example: true
 *               activateCorrespondents:
 *                 type: boolean
 *                 description: Enable AI-based correspondent suggestions
 *                 example: true
 *               activateDocumentType:
 *                 type: boolean
 *                 description: Enable AI-based document type suggestions
 *                 example: true
 *               activateTitle:
 *                 type: boolean
 *                 description: Enable AI-based title suggestions
 *                 example: true
 *               activateCustomFields:
 *                 type: boolean
 *                 description: Enable AI-based custom field extraction
 *                 example: false
 *               customFields:
 *                 type: string
 *                 description: JSON string defining custom fields to extract
 *                 example: '{"invoice_number":{"type":"string"},"total_amount":{"type":"number"}}'
 *               disableAutomaticProcessing:
 *                 type: boolean
 *                 description: Disable automatic document processing
 *                 example: false
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: ["success"]
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Settings updated successfully"
 *       400:
 *         description: Invalid configuration parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: ["error"]
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Invalid settings: AI provider required when automatic processing is enabled"
 *       500:
 *         description: Server error while updating settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: ["error"]
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Failed to update settings: Database error"
 */
router.post('/settings', express.json(), async (req, res) => {
  try {
    const {
      paperlessUrl,
      paperlessToken,
      aiProvider,
      openaiKey,
      openaiModel,
      ollamaUrl,
      ollamaModel,
      ollamaContextWindow,
      ollamaMaxResponseTokens,
      ollamaVisionContextWindow,
      ollamaVisionMaxResponseTokens,
      ollamaExpertContextWindow,
      ollamaExpertMaxResponseTokens,
      translationContextWindow,
      translationMaxTokens,
      expertPipelineEnabled,
      medicalVisionModel: medicalVisionModelInput,
      medicalAnalysisModel,
      medicalRadiologyModel,
      medicalVisionContextWindow,
      medicalVisionMaxResponseTokens,
      medicalAnalysisContextWindow,
      medicalAnalysisMaxResponseTokens,
      medicalRadiologyContextWindow,
      medicalRadiologyMaxResponseTokens,
      orchestratorModel,
      orchestratorContextWindow,
      orchestratorMaxResponseTokens,
      plannerModel,
      routerModel,
      plannerContextWindow,
      plannerMaxResponseTokens,
      routerContextWindow,
      routerMaxResponseTokens,
      financialVisionModel,
      financialAnalysisModel,
      financialVatExpertModel,
      financialVisionContextWindow,
      financialVisionMaxResponseTokens,
      financialAnalysisContextWindow,
      financialAnalysisMaxResponseTokens,
      financialVatExpertContextWindow,
      financialVatExpertMaxResponseTokens,
      legalVisionModel,
      legalAnalysisModel,
      legalOrchestratorModel,
      legalVisionContextWindow,
      legalVisionMaxResponseTokens,
      legalAnalysisContextWindow,
      legalAnalysisMaxResponseTokens,
      legalOrchestratorContextWindow,
      legalOrchestratorMaxResponseTokens,
      scanInterval,
      systemPrompt,
      showTags,
      tokenLimit,
      responseTokens,
      tags,
      aiProcessedTag,
      aiTagName,
      usePromptTags,
      promptTags,
      paperlessUsername,
      useExistingData,
      customApiKey,
      customBaseUrl,
      customModel,
      activateTagging,
      activateCorrespondents,
      activateDocumentType,
      activateTitle,
      activateCustomFields,
      customFields,
      disableAutomaticProcessing,
      azureEndpoint,
      azureApiKey,
      azureDeploymentName,
      azureApiVersion,
      qdrantHost,
      qdrantPort,
      qdrantApiKey,
      vectorStore
    } = req.body;

    //replace equal char in system prompt
    const processedPrompt = systemPrompt
      ? systemPrompt.replace(/\r\n/g, '\n').replace(/=/g, '')
      : '';


    const currentConfig = {
      PAPERLESS_API_URL: process.env.PAPERLESS_API_URL || '',
      PAPERLESS_API_TOKEN: process.env.PAPERLESS_API_TOKEN || '',
      PAPERLESS_USERNAME: process.env.PAPERLESS_USERNAME || '',
      AI_PROVIDER: process.env.AI_PROVIDER || '',
      PAPERLESS_OPENAI_API_KEY: process.env.PAPERLESS_OPENAI_API_KEY || '',
      PAPERLESS_OPENAI_MODEL: process.env.PAPERLESS_OPENAI_MODEL || '',
      OLLAMA_API_URL: process.env.OLLAMA_API_URL || '',
      OLLAMA_MODEL: process.env.OLLAMA_MODEL || '',
      OLLAMA_CONTEXT_WINDOW: process.env.OLLAMA_CONTEXT_WINDOW || '',
      OLLAMA_MAX_RESPONSE_TOKENS: process.env.OLLAMA_MAX_RESPONSE_TOKENS || '',
      OLLAMA_VISION_CONTEXT_WINDOW: process.env.OLLAMA_VISION_CONTEXT_WINDOW || '',
      OLLAMA_VISION_MAX_RESPONSE_TOKENS: process.env.OLLAMA_VISION_MAX_RESPONSE_TOKENS || '',
      OLLAMA_EXPERT_CONTEXT_WINDOW: process.env.OLLAMA_EXPERT_CONTEXT_WINDOW || '',
      OLLAMA_EXPERT_MAX_RESPONSE_TOKENS: process.env.OLLAMA_EXPERT_MAX_RESPONSE_TOKENS || '',
      TRANSLATION_CONTEXT_WINDOW: process.env.TRANSLATION_CONTEXT_WINDOW || '',
      TRANSLATION_MAX_TOKENS: process.env.TRANSLATION_MAX_TOKENS || '',
      OLLAMA_MODEL_LIMITS_JSON: process.env.OLLAMA_MODEL_LIMITS_JSON || '',
      EXPERT_PIPELINE_ENABLED: process.env.EXPERT_PIPELINE_ENABLED || 'yes',
      MEDICAL_VISION_MODEL: process.env.MEDICAL_VISION_MODEL || 'qwen3-vl:8b',
      MEDICAL_ANALYSIS_MODEL: process.env.MEDICAL_ANALYSIS_MODEL || 'medtext-llama3',
      MEDICAL_RADIOLOGY_MODEL: process.env.MEDICAL_RADIOLOGY_MODEL || 'llava-med-v1.6',
      PLANNER_MODEL: process.env.PLANNER_MODEL || '',
      ROUTER_MODEL: process.env.ROUTER_MODEL || '',
      ORCHESTRATOR_MODEL: process.env.ORCHESTRATOR_MODEL || '',
      FINANCIAL_VISION_MODEL: process.env.FINANCIAL_VISION_MODEL || '',
      FINANCIAL_ANALYSIS_MODEL: process.env.FINANCIAL_ANALYSIS_MODEL || '',
      FINANCIAL_VAT_EXPERT: process.env.FINANCIAL_VAT_EXPERT || '',
      LEGAL_VISION_MODEL: process.env.LEGAL_VISION_MODEL || '',
      LEGAL_ANALYSIS_MODEL: process.env.LEGAL_ANALYSIS_MODEL || '',
      LEGAL_ORCHESTRATOR_MODEL: process.env.LEGAL_ORCHESTRATOR_MODEL || '',
      SCAN_INTERVAL: process.env.SCAN_INTERVAL || '*/30 * * * *',
      SYSTEM_PROMPT: process.env.SYSTEM_PROMPT || '',
      PROCESS_PREDEFINED_DOCUMENTS: process.env.PROCESS_PREDEFINED_DOCUMENTS || 'no',
      TOKEN_LIMIT: process.env.TOKEN_LIMIT || 128000,
      RESPONSE_TOKENS: process.env.RESPONSE_TOKENS || 1000,
      TAGS: process.env.TAGS || '',
      ADD_AI_PROCESSED_TAG: process.env.ADD_AI_PROCESSED_TAG || 'no',
      AI_PROCESSED_TAG_NAME: process.env.AI_PROCESSED_TAG_NAME || 'ai-processed',
      USE_PROMPT_TAGS: process.env.USE_PROMPT_TAGS || 'no',
      PROMPT_TAGS: process.env.PROMPT_TAGS || '',
      USE_EXISTING_DATA: process.env.USE_EXISTING_DATA || 'no',
      API_KEY: process.env.API_KEY || '',
      CUSTOM_API_KEY: process.env.CUSTOM_API_KEY || '',
      CUSTOM_BASE_URL: process.env.CUSTOM_BASE_URL || '',
      CUSTOM_MODEL: process.env.CUSTOM_MODEL || '',
      ACTIVATE_TAGGING: process.env.ACTIVATE_TAGGING || 'yes',
      ACTIVATE_CORRESPONDENTS: process.env.ACTIVATE_CORRESPONDENTS || 'yes',
      ACTIVATE_DOCUMENT_TYPE: process.env.ACTIVATE_DOCUMENT_TYPE || 'yes',
      ACTIVATE_TITLE: process.env.ACTIVATE_TITLE || 'yes',
      ACTIVATE_CUSTOM_FIELDS: process.env.ACTIVATE_CUSTOM_FIELDS || 'yes',
      CUSTOM_FIELDS: process.env.CUSTOM_FIELDS || '{"custom_fields":[]}',
      DISABLE_AUTOMATIC_PROCESSING: process.env.DISABLE_AUTOMATIC_PROCESSING || 'no',
      AZURE_ENDPOINT: process.env.AZURE_ENDPOINT|| '',
      AZURE_API_KEY: process.env.AZURE_API_KEY || '',
      AZURE_DEPLOYMENT_NAME: process.env.AZURE_DEPLOYMENT_NAME || '',
      AZURE_API_VERSION: process.env.AZURE_API_VERSION || '',
      QDRANT_HOST: process.env.QDRANT_HOST || 'qdrant',
      QDRANT_PORT: process.env.QDRANT_PORT || '6333',
      QDRANT_API_KEY: process.env.QDRANT_API_KEY || '',
      VECTOR_STORE: process.env.VECTOR_STORE || 'qdrant',
      RESTRICT_TO_EXISTING_TAGS: process.env.RESTRICT_TO_EXISTING_TAGS || 'no',
      RESTRICT_TO_EXISTING_CORRESPONDENTS: process.env.RESTRICT_TO_EXISTING_CORRESPONDENTS || 'no',
      RESTRICT_TO_EXISTING_DOCUMENT_TYPES: process.env.RESTRICT_TO_EXISTING_DOCUMENT_TYPES || 'no',
      EXTERNAL_API_ENABLED: process.env.EXTERNAL_API_ENABLED || 'no',
      EXTERNAL_API_URL: process.env.EXTERNAL_API_URL || '',
      EXTERNAL_API_METHOD: process.env.EXTERNAL_API_METHOD || 'GET',
      EXTERNAL_API_HEADERS: process.env.EXTERNAL_API_HEADERS || '{}',
      EXTERNAL_API_BODY: process.env.EXTERNAL_API_BODY || '{}',
      EXTERNAL_API_TIMEOUT: process.env.EXTERNAL_API_TIMEOUT || '5000',
      EXTERNAL_API_TRANSFORM: process.env.EXTERNAL_API_TRANSFORM || ''
    };

    // Process custom fields
    let processedCustomFields = [];
    if (customFields) {
      try {
        const parsedFields = typeof customFields === 'string'
          ? JSON.parse(customFields)
          : customFields;

        processedCustomFields = parsedFields.custom_fields.map(field => ({
          value: field.value,
          data_type: field.data_type,
          ...(field.currency && { currency: field.currency })
        }));
      } catch (error) {
        console.error('Error processing custom fields:', error);
        processedCustomFields = [];
      }
    }

    try {
      for (const field of processedCustomFields) {
        await paperlessService.createCustomFieldSafely(field.value, field.data_type, field.currency);
      }
    } catch (error) {
      console.log('[ERROR] Error creating custom fields:', error);
    }

    // Extract tag and correspondent restriction settings with defaults
    const restrictToExistingTags = req.body.restrictToExistingTags === 'on' || req.body.restrictToExistingTags === 'yes';
    const pipelineTagReplace = req.body.pipelineTagReplace === 'on' || req.body.pipelineTagReplace === 'yes';
    const restrictToExistingCorrespondents = req.body.restrictToExistingCorrespondents === 'on' || req.body.restrictToExistingCorrespondents === 'yes';
    const restrictToExistingDocumentTypes = req.body.restrictToExistingDocumentTypes === 'on' || req.body.restrictToExistingDocumentTypes === 'yes';

    // Extract external API settings with defaults
    const externalApiEnabled = req.body.externalApiEnabled === 'on' || req.body.externalApiEnabled === 'yes';
    const externalApiUrl = req.body.externalApiUrl || '';
    const externalApiMethod = req.body.externalApiMethod || 'GET';
    const externalApiHeaders = req.body.externalApiHeaders || '{}';
    const externalApiBody = req.body.externalApiBody || '{}';
    const externalApiTimeout = req.body.externalApiTimeout || '5000';
    const externalApiTransform = req.body.externalApiTransform || '';

    if (paperlessUrl !== currentConfig.PAPERLESS_API_URL?.replace('/api', '') ||
        paperlessToken !== currentConfig.PAPERLESS_API_TOKEN) {
      const isPaperlessValid = await setupService.validatePaperlessConfig(paperlessUrl, paperlessToken);
      if (!isPaperlessValid) {
        return res.status(400).json({
          error: 'Paperless-ngx connection failed. Please check URL and Token.'
        });
      }
    }

    const updatedConfig = {};

    if (paperlessUrl) updatedConfig.PAPERLESS_API_URL = paperlessUrl + '/api';
    if (paperlessToken) updatedConfig.PAPERLESS_API_TOKEN = paperlessToken;
    if (paperlessUsername) updatedConfig.PAPERLESS_USERNAME = paperlessUsername;

    // Handle AI provider configuration
    if (aiProvider) {
      updatedConfig.AI_PROVIDER = aiProvider;

      if (aiProvider === 'openai' && openaiKey) {
        const isOpenAIValid = await setupService.validateOpenAIConfig(openaiKey);
        if (!isOpenAIValid) {
          return res.status(400).json({
            error: 'OpenAI API Key is not valid. Please check the key.'
          });
        }
        updatedConfig.PAPERLESS_OPENAI_API_KEY = openaiKey;
        if (openaiModel) updatedConfig.PAPERLESS_OPENAI_MODEL = openaiModel;
      }
      else if (aiProvider === 'ollama' && (ollamaUrl || ollamaModel)) {
        const isOllamaValid = await setupService.validateOllamaConfig(
          ollamaUrl || currentConfig.OLLAMA_API_URL,
          ollamaModel || currentConfig.OLLAMA_MODEL
        );
        if (!isOllamaValid) {
          return res.status(400).json({
            error: 'Ollama connection failed. Please check URL and Model.'
          });
        }
        if (ollamaUrl) updatedConfig.OLLAMA_API_URL = ollamaUrl;
        if (ollamaModel) updatedConfig.OLLAMA_MODEL = ollamaModel;
      } else if (aiProvider === 'azure') {
        const isAzureValid = await setupService.validateAzureConfig(azureApiKey, azureEndpoint, azureDeploymentName, azureApiVersion);
        if (!isAzureValid) {
          return res.status(400).json({
            error: 'Azure connection failed. Please check URL, API Key, Deployment Name and API Version.'
          });
        }
        if(azureEndpoint) updatedConfig.AZURE_ENDPOINT = azureEndpoint;
        if(azureApiKey) updatedConfig.AZURE_API_KEY = azureApiKey;
        if(azureDeploymentName) updatedConfig.AZURE_DEPLOYMENT_NAME = azureDeploymentName;
        if(azureApiVersion) updatedConfig.AZURE_API_VERSION = azureApiVersion;
      }
    }

    // Update Qdrant settings
    if (qdrantHost) updatedConfig.QDRANT_HOST = qdrantHost;
    if (qdrantPort) updatedConfig.QDRANT_PORT = qdrantPort;
    if (qdrantApiKey) updatedConfig.QDRANT_API_KEY = qdrantApiKey;
    if (vectorStore) updatedConfig.VECTOR_STORE = vectorStore;

    // Update general settings
    if (scanInterval) updatedConfig.SCAN_INTERVAL = scanInterval;
    if (systemPrompt) updatedConfig.SYSTEM_PROMPT = processedPrompt.replace(/\r\n/g, '\n').replace(/\n/g, '\\n');
    if (showTags) updatedConfig.PROCESS_PREDEFINED_DOCUMENTS = showTags;
    if (tokenLimit) updatedConfig.TOKEN_LIMIT = tokenLimit;
    if (responseTokens) updatedConfig.RESPONSE_TOKENS = responseTokens;
    if (ollamaContextWindow !== undefined) updatedConfig.OLLAMA_CONTEXT_WINDOW = ollamaContextWindow;
    if (ollamaMaxResponseTokens !== undefined) updatedConfig.OLLAMA_MAX_RESPONSE_TOKENS = ollamaMaxResponseTokens;
    if (ollamaVisionContextWindow !== undefined) updatedConfig.OLLAMA_VISION_CONTEXT_WINDOW = ollamaVisionContextWindow;
    if (ollamaVisionMaxResponseTokens !== undefined) updatedConfig.OLLAMA_VISION_MAX_RESPONSE_TOKENS = ollamaVisionMaxResponseTokens;
    if (ollamaExpertContextWindow !== undefined) updatedConfig.OLLAMA_EXPERT_CONTEXT_WINDOW = ollamaExpertContextWindow;
    if (ollamaExpertMaxResponseTokens !== undefined) updatedConfig.OLLAMA_EXPERT_MAX_RESPONSE_TOKENS = ollamaExpertMaxResponseTokens;
    if (translationContextWindow !== undefined) updatedConfig.TRANSLATION_CONTEXT_WINDOW = translationContextWindow;
    if (translationMaxTokens !== undefined) updatedConfig.TRANSLATION_MAX_TOKENS = translationMaxTokens;
    if (tags !== undefined) updatedConfig.TAGS = normalizeArray(tags);
    if (aiProcessedTag) updatedConfig.ADD_AI_PROCESSED_TAG = aiProcessedTag;
    if (aiTagName) updatedConfig.AI_PROCESSED_TAG_NAME = aiTagName;
    if (usePromptTags) updatedConfig.USE_PROMPT_TAGS = usePromptTags;
    if (promptTags) updatedConfig.PROMPT_TAGS = normalizeArray(promptTags);
    if (useExistingData) updatedConfig.USE_EXISTING_DATA = useExistingData;
    if (customApiKey) updatedConfig.CUSTOM_API_KEY = customApiKey;
    if (customBaseUrl) updatedConfig.CUSTOM_BASE_URL = customBaseUrl;
    if (customModel) updatedConfig.CUSTOM_MODEL = customModel;
    if (disableAutomaticProcessing) updatedConfig.DISABLE_AUTOMATIC_PROCESSING = disableAutomaticProcessing;
    updatedConfig.EXPERT_PIPELINE_ENABLED = (expertPipelineEnabled === 'on' || expertPipelineEnabled === 'yes') ? 'yes' : 'no';
    const resolvedMedicalVisionModel = medicalVisionModelInput || 'qwen3-vl:8b';
    const resolvedMedicalAnalysisModel = medicalAnalysisModel || 'medtext-llama3';
    const resolvedMedicalRadiologyModel = medicalRadiologyModel || 'llava-med-v1.6';
    const resolvedPlannerModel = plannerModel || 'qwen3-vl:8b';
    const resolvedRouterModel = routerModel || resolvedPlannerModel || 'qwen3-vl:8b';
    const resolvedOrchestratorModel = orchestratorModel || 'nemotron-orchestrator:8b';
    const resolvedFinancialVisionModel = financialVisionModel || 'llm-pro-finance-8b';
    const resolvedFinancialAnalysisModel = financialAnalysisModel || 'fino1-8b';
    const resolvedFinancialVatExpertModel = financialVatExpertModel || 'llm-pro-finance-8b';
    const resolvedLegalVisionModel = legalVisionModel || 'qwen3-vl:8b';
    const resolvedLegalAnalysisModel = legalAnalysisModel || 'llm-pro-finance-8b';
    const resolvedLegalOrchestratorModel = legalOrchestratorModel || resolvedOrchestratorModel;

    updatedConfig.MEDICAL_VISION_MODEL = resolvedMedicalVisionModel;
    updatedConfig.MEDICAL_ANALYSIS_MODEL = resolvedMedicalAnalysisModel;
    updatedConfig.MEDICAL_RADIOLOGY_MODEL = resolvedMedicalRadiologyModel;
    updatedConfig.PLANNER_MODEL = resolvedPlannerModel;
    updatedConfig.ROUTER_MODEL = resolvedRouterModel;
    updatedConfig.ORCHESTRATOR_MODEL = resolvedOrchestratorModel;
    updatedConfig.FINANCIAL_VISION_MODEL = resolvedFinancialVisionModel;
    updatedConfig.FINANCIAL_ANALYSIS_MODEL = resolvedFinancialAnalysisModel;
    updatedConfig.FINANCIAL_VAT_EXPERT = resolvedFinancialVatExpertModel;
    updatedConfig.LEGAL_VISION_MODEL = resolvedLegalVisionModel;
    updatedConfig.LEGAL_ANALYSIS_MODEL = resolvedLegalAnalysisModel;
    updatedConfig.LEGAL_ORCHESTRATOR_MODEL = resolvedLegalOrchestratorModel;

    const modelLimits = parseOllamaModelLimits(currentConfig.OLLAMA_MODEL_LIMITS_JSON);
    upsertModelLimit(modelLimits, resolvedPlannerModel, 'planner', plannerContextWindow, plannerMaxResponseTokens);
    upsertModelLimit(modelLimits, resolvedRouterModel, 'expert', routerContextWindow, routerMaxResponseTokens);
    upsertModelLimit(modelLimits, resolvedOrchestratorModel, 'expert', orchestratorContextWindow, orchestratorMaxResponseTokens);
    upsertModelLimit(modelLimits, resolvedMedicalVisionModel, 'vision', medicalVisionContextWindow, medicalVisionMaxResponseTokens);
    upsertModelLimit(modelLimits, resolvedMedicalAnalysisModel, 'expert', medicalAnalysisContextWindow, medicalAnalysisMaxResponseTokens);
    upsertModelLimit(modelLimits, resolvedMedicalRadiologyModel, 'vision', medicalRadiologyContextWindow, medicalRadiologyMaxResponseTokens);
    upsertModelLimit(modelLimits, resolvedFinancialVisionModel, 'vision', financialVisionContextWindow, financialVisionMaxResponseTokens);
    upsertModelLimit(modelLimits, resolvedFinancialAnalysisModel, 'expert', financialAnalysisContextWindow, financialAnalysisMaxResponseTokens);
    upsertModelLimit(modelLimits, resolvedFinancialVatExpertModel, 'expert', financialVatExpertContextWindow, financialVatExpertMaxResponseTokens);
    upsertModelLimit(modelLimits, resolvedLegalVisionModel, 'vision', legalVisionContextWindow, legalVisionMaxResponseTokens);
    upsertModelLimit(modelLimits, resolvedLegalAnalysisModel, 'expert', legalAnalysisContextWindow, legalAnalysisMaxResponseTokens);
    upsertModelLimit(modelLimits, resolvedLegalOrchestratorModel, 'expert', legalOrchestratorContextWindow, legalOrchestratorMaxResponseTokens);
    updatedConfig.OLLAMA_MODEL_LIMITS_JSON = Object.keys(modelLimits).length > 0
      ? JSON.stringify(modelLimits)
      : '';

    // Update custom fields
    if (processedCustomFields.length > 0 || customFields) {
      updatedConfig.CUSTOM_FIELDS = JSON.stringify({
        custom_fields: processedCustomFields
      });
    }

      // Handle limit functions
      updatedConfig.ACTIVATE_TAGGING = activateTagging ? 'yes' : 'no';
      updatedConfig.ACTIVATE_CORRESPONDENTS = activateCorrespondents ? 'yes' : 'no';
      updatedConfig.ACTIVATE_DOCUMENT_TYPE = activateDocumentType ? 'yes' : 'no';
      updatedConfig.ACTIVATE_TITLE = activateTitle ? 'yes' : 'no';
      updatedConfig.ACTIVATE_CUSTOM_FIELDS = activateCustomFields ? 'yes' : 'no';

      // Handle tag and correspondent restrictions
      updatedConfig.RESTRICT_TO_EXISTING_TAGS = restrictToExistingTags ? 'yes' : 'no';
      updatedConfig.PIPELINE_TAG_REPLACE = pipelineTagReplace ? 'yes' : 'no';
      updatedConfig.RESTRICT_TO_EXISTING_CORRESPONDENTS = restrictToExistingCorrespondents ? 'yes' : 'no';
      updatedConfig.RESTRICT_TO_EXISTING_DOCUMENT_TYPES = restrictToExistingDocumentTypes ? 'yes' : 'no';

      // Handle external API integration
      updatedConfig.EXTERNAL_API_ENABLED = externalApiEnabled ? 'yes' : 'no';
      updatedConfig.EXTERNAL_API_URL = externalApiUrl || '';
      updatedConfig.EXTERNAL_API_METHOD = externalApiMethod || 'GET';
      updatedConfig.EXTERNAL_API_HEADERS = externalApiHeaders || '{}';
      updatedConfig.EXTERNAL_API_BODY = externalApiBody || '{}';
      updatedConfig.EXTERNAL_API_TIMEOUT = externalApiTimeout || '5000';
      updatedConfig.EXTERNAL_API_TRANSFORM = externalApiTransform || '';

    // Handle API key
    let apiToken = process.env.API_KEY;
    if (!apiToken) {
      console.log('Generating new API key');
      apiToken = require('crypto').randomBytes(64).toString('hex');
      updatedConfig.API_KEY = apiToken;
    }

    const mergedConfig = {
      ...currentConfig,
      ...updatedConfig
    };

    await setupService.saveConfig(mergedConfig);
    try {
      for (const field of processedCustomFields) {
        await paperlessService.createCustomFieldSafely(field.value, field.data_type, field.currency);
      }
    } catch (error) {
      console.log('[ERROR] Error creating custom fields:', error);
    }

    res.json({
      success: true,
      message: 'Configuration saved successfully.',
      restart: true
    });

    setTimeout(() => {
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({
      error: 'An error occurred: ' + error.message
    });
  }
});

/**
 * @swagger
 * /settings/presets:
 *   get:
 *     summary: List available configuration presets
 *     description: Returns a list of predefined configuration presets
 *     tags:
 *       - Settings
 *     responses:
 *       200:
 *         description: Presets retrieved successfully
 */
router.get('/settings/presets', async (req, res) => {
  try {
    const presetsDir = path.join(__dirname, '..', 'config', 'presets');
    const files = await fs.readdir(presetsDir);
    const presetFiles = files.filter(f => f.endsWith('.json'));

    const presets = [];
    for (const file of presetFiles) {
      try {
        const filePath = path.join(presetsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const preset = JSON.parse(content);

        // Return only metadata, not settings
        presets.push({
          name: preset.name,
          displayName: preset.displayName,
          description: preset.description,
          category: preset.category,
          icon: preset.icon
        });
      } catch (error) {
        logger.warn('[PRESETS] Failed to load preset file', { file, error: error.message });
      }
    }

    res.json({ presets });
  } catch (error) {
    logger.error('[PRESETS] Failed to list presets', { error: error.message });
    res.status(500).json({ error: 'Failed to list presets' });
  }
});

/**
 * @swagger
 * /settings/presets/{name}:
 *   post:
 *     summary: Load or preview a configuration preset
 *     description: Load a preset and apply settings, or preview changes without applying
 *     tags:
 *       - Settings
 *     parameters:
 *       - name: name
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preview:
 *                 type: boolean
 *                 description: If true, return diff without applying
 */
router.post('/settings/presets/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { preview = false } = req.body;

    // Load preset file
    const presetPath = path.join(__dirname, '..', 'config', 'presets', `${name}.json`);
    const presetContent = await fs.readFile(presetPath, 'utf8');
    const preset = JSON.parse(presetContent);

    // Load current .env settings
    const envPath = path.join(__dirname, '..', 'data', '.env');
    let currentEnv = {};
    try {
      const envContent = await fs.readFile(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key) {
            currentEnv[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
    } catch (error) {
      logger.warn('[PRESETS] Failed to read current .env', { error: error.message });
    }

    // Calculate diff
    const changes = [];
    let requiresRestart = false;

    for (const [key, newValue] of Object.entries(preset.settings)) {
      const currentValue = currentEnv[key];
      if (currentValue !== newValue) {
        changes.push({
          key,
          currentValue: currentValue || null,
          newValue,
          category: 'Preset'
        });
        requiresRestart = true; // Most preset changes require restart
      }
    }

    const diff = {
      presetName: preset.displayName,
      changes,
      requiresRestart
    };

    // If preview mode, return diff without applying
    if (preview) {
      return res.json({ diff });
    }

    // Apply preset settings
    for (const [key, value] of Object.entries(preset.settings)) {
      currentEnv[key] = value;
    }

    // Write updated .env file
    const envLines = Object.entries(currentEnv).map(([key, value]) => `${key}=${value}`);
    await fs.writeFile(envPath, envLines.join('\n') + '\n', 'utf8');

    logger.info('[PRESETS] Applied preset', { preset: name, changesCount: changes.length });

    res.json({
      success: true,
      preset: name,
      requiresRestart,
      changesCount: changes.length
    });
  } catch (error) {
    logger.error('[PRESETS] Failed to load preset', { error: error.message });

    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Preset not found' });
    }

    res.status(500).json({ error: 'Failed to load preset' });
  }
});

/**
 * @swagger
 * /settings/export:
 *   get:
 *     summary: Export current settings as .env file
 *     description: Downloads all current settings as a .env file with timestamp
 *     tags:
 *       - Settings
 *     responses:
 *       200:
 *         description: Settings exported successfully
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/settings/export', async (req, res) => {
  try {
    const envPath = path.join(__dirname, '..', 'data', '.env');
    let envContent = '';

    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      logger.error('[EXPORT] Failed to read .env file', { error: error.message });
      return res.status(500).json({ error: 'Failed to read settings' });
    }

    // Parse and group settings by category
    const lines = envContent.split('\n');
    const grouped = {
      connection: [],
      ai: [],
      expert: [],
      features: [],
      processing: [],
      performance: [],
      other: []
    };

    lines.forEach(line => {
      const trimmed = line.trim();

      // Keep comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }

      // Categorize based on key name
      const [key] = trimmed.split('=');
      if (!key) return;

      const keyUpper = key.toUpperCase();

      if (keyUpper.includes('PAPERLESS') || keyUpper.includes('API_URL') || keyUpper.includes('API_TOKEN')) {
        grouped.connection.push(trimmed);
      } else if (keyUpper.includes('OPENAI') || keyUpper.includes('OLLAMA') || keyUpper.includes('AZURE') || keyUpper.includes('AI_PROVIDER')) {
        grouped.ai.push(trimmed);
      } else if (keyUpper.includes('MEDICAL') || keyUpper.includes('FINANCIAL') || keyUpper.includes('LEGAL') || keyUpper.includes('EXPERT')) {
        grouped.expert.push(trimmed);
      } else if (keyUpper.includes('ENABLE') || keyUpper.includes('ENABLED') || keyUpper.includes('FORCE') || keyUpper.includes('GUIDANCE')) {
        grouped.features.push(trimmed);
      } else if (keyUpper.includes('SCAN') || keyUpper.includes('PROCESSING') || keyUpper.includes('AUTOMATIC')) {
        grouped.processing.push(trimmed);
      } else if (keyUpper.includes('TOKEN') || keyUpper.includes('TIMEOUT') || keyUpper.includes('THRESHOLD') || keyUpper.includes('LIMIT')) {
        grouped.performance.push(trimmed);
      } else {
        grouped.other.push(trimmed);
      }
    });

    // Build categorized .env content
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    let exportContent = `# Paperless-AI Settings Export
# Generated: ${new Date().toISOString()}
# Timestamp: ${timestamp}

`;

    if (grouped.connection.length > 0) {
      exportContent += `# === Connection Settings ===\n${grouped.connection.join('\n')}\n\n`;
    }

    if (grouped.ai.length > 0) {
      exportContent += `# === AI Provider Settings ===\n${grouped.ai.join('\n')}\n\n`;
    }

    if (grouped.expert.length > 0) {
      exportContent += `# === Expert Models ===\n${grouped.expert.join('\n')}\n\n`;
    }

    if (grouped.features.length > 0) {
      exportContent += `# === Feature Flags ===\n${grouped.features.join('\n')}\n\n`;
    }

    if (grouped.processing.length > 0) {
      exportContent += `# === Processing Settings ===\n${grouped.processing.join('\n')}\n\n`;
    }

    if (grouped.performance.length > 0) {
      exportContent += `# === Performance Settings ===\n${grouped.performance.join('\n')}\n\n`;
    }

    if (grouped.other.length > 0) {
      exportContent += `# === Other Settings ===\n${grouped.other.join('\n')}\n\n`;
    }

    // Set headers for file download
    const filename = `paperless-ai-settings-${timestamp}.env`;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportContent);

    logger.info('[EXPORT] Settings exported successfully', { filename });
  } catch (error) {
    logger.error('[EXPORT] Failed to export settings', { error: error.message });
    res.status(500).json({ error: 'Failed to export settings' });
  }
});

/**
 * @swagger
 * /settings/import:
 *   post:
 *     summary: Import settings from .env file
 *     description: Upload and validate a .env file, optionally preview changes before applying
 *     tags:
 *       - Settings
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               preview:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Import successful or preview generated
 */
router.post('/settings/import', async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadedFile = req.files.file;
    const preview = req.body.preview === 'true' || req.body.preview === true;

    // Validate file type
    if (!uploadedFile.name.endsWith('.env')) {
      return res.status(400).json({ error: 'Invalid file type. Please upload a .env file' });
    }

    // Parse uploaded .env content
    const uploadedContent = uploadedFile.data.toString('utf8');
    const uploadedSettings = {};
    const parseErrors = [];

    uploadedContent.split('\n').forEach((line, index) => {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }

      // Parse key=value
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) {
        parseErrors.push(`Line ${index + 1}: Invalid format (expected KEY=VALUE)`);
        return;
      }

      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();

      if (!key) {
        parseErrors.push(`Line ${index + 1}: Empty key`);
        return;
      }

      uploadedSettings[key] = value;
    });

    // Return validation errors if any
    if (parseErrors.length > 0) {
      return res.status(400).json({
        error: 'Invalid .env file format',
        details: parseErrors
      });
    }

    // Load current .env settings
    const envPath = path.join(__dirname, '..', 'data', '.env');
    let currentEnv = {};
    try {
      const envContent = await fs.readFile(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key) {
            currentEnv[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
    } catch (error) {
      logger.warn('[IMPORT] Failed to read current .env', { error: error.message });
    }

    // Calculate diff
    const changes = [];
    let requiresRestart = false;

    for (const [key, newValue] of Object.entries(uploadedSettings)) {
      const currentValue = currentEnv[key];
      if (currentValue !== newValue) {
        changes.push({
          key,
          currentValue: currentValue || null,
          newValue,
          category: 'Import'
        });
        requiresRestart = true; // Imported settings likely require restart
      }
    }

    const diff = {
      presetName: 'Imported Settings',
      changes,
      requiresRestart
    };

    // If preview mode, return diff without applying
    if (preview) {
      return res.json({ diff, settingsCount: Object.keys(uploadedSettings).length });
    }

    // Apply imported settings
    const mergedEnv = { ...currentEnv, ...uploadedSettings };

    // Write updated .env file
    const envLines = Object.entries(mergedEnv).map(([key, value]) => `${key}=${value}`);
    await fs.writeFile(envPath, envLines.join('\n') + '\n', 'utf8');

    logger.info('[IMPORT] Settings imported successfully', {
      changesCount: changes.length,
      totalSettings: Object.keys(uploadedSettings).length
    });

    res.json({
      success: true,
      requiresRestart,
      changesCount: changes.length,
      totalSettings: Object.keys(uploadedSettings).length
    });
  } catch (error) {
    logger.error('[IMPORT] Failed to import settings', { error: error.message });
    res.status(500).json({ error: 'Failed to import settings' });
  }
});

module.exports = router;
