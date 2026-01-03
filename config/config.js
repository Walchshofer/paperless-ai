const path = require('path');
const currentDir = decodeURIComponent(process.cwd());
const envPath = path.join(currentDir, 'data', '.env');
console.log('Loading .env from:', envPath); // Debug log
require('dotenv').config({ path: envPath });

// Helper function to parse boolean-like env vars
const parseEnvBoolean = (value, defaultValue = 'yes') => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes' ? 'yes' : 'no';
};

const parseEnvInt = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseEnvJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (error) {
    console.warn('[WARN] Failed to parse JSON env var:', error.message);
    return fallback;
  }
};

const resolveEnvAlias = (canonicalKey, aliases = []) => {
  const canonicalValue = process.env[canonicalKey];
  let aliasValue;
  let aliasKey;
  for (const alias of aliases) {
    const value = process.env[alias];
    if (value !== undefined && value !== '') {
      aliasValue = value;
      aliasKey = alias;
      break;
    }
  }
  if (canonicalValue && aliasValue && canonicalValue !== aliasValue) {
    console.warn(`[WARN] ${canonicalKey} and ${aliasKey} are both set; using ${canonicalKey}.`);
  }
  if (!canonicalValue && aliasValue) {
    process.env[canonicalKey] = aliasValue;
    return aliasValue;
  }
  return canonicalValue;
};

resolveEnvAlias('ENABLE_VISUAL_RAG', ['VISUAL_RAG_ENABLED']);
resolveEnvAlias('PAPERLESS_OCR_LANGUAGES', ['PAPERLESS_OCR_LANGUAGE']);
const resolvedOllamaModel = resolveEnvAlias('OLLAMA_MODEL', ['AI_MODEL']);

const requireEnv = (key, fallbackKeys = []) => {
  const value = process.env[key];
  if (value && value !== '') return value;
  
  for (const fallbackKey of fallbackKeys) {
    const fallbackValue = process.env[fallbackKey];
    if (fallbackValue && fallbackValue !== '') return fallbackValue;
  }
  
  const allKeys = [key, ...fallbackKeys].join(' or ');
  throw new Error(
    `Missing required environment variable: ${allKeys}\n` +
    `Please ensure your docker-compose.env file is loaded correctly.`
  );
};

const mergeModelLimitEntries = (baseEntry, overrideEntry) => {
  const merged = baseEntry && typeof baseEntry === 'object' ? { ...baseEntry } : {};
  if (!overrideEntry || typeof overrideEntry !== 'object') return merged;
  for (const [key, value] of Object.entries(overrideEntry)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = { ...(merged[key] || {}), ...value };
    } else {
      merged[key] = value;
    }
  }
  return merged;
};

const mergeModelLimits = (defaults, overrides) => {
  const merged = { ...(defaults || {}) };
  if (!overrides || typeof overrides !== 'object') return merged;
  for (const [model, entry] of Object.entries(overrides)) {
    merged[model] = mergeModelLimitEntries(merged[model], entry);
  }
  return merged;
};

const setModelLimit = (target, modelName, kind, limits) => {
  if (!modelName || !kind || !limits) return;
  const trimmed = String(modelName).trim();
  if (!trimmed) return;
  if (!target[trimmed]) target[trimmed] = {};
  target[trimmed][kind] = {
    contextWindow: limits.contextWindow,
    maxResponseTokens: limits.maxResponseTokens
  };
};

const ollamaModel = resolvedOllamaModel || 'sauerkraut-llama3.1:8b';
const ollamaVisionModel = process.env.OLLAMA_VISION_MODEL || 'qwen3-vl:8b';
const plannerModel = process.env.PLANNER_MODEL ||
  process.env.OLLAMA_PLANNER_MODEL ||
  ollamaVisionModel ||
  'qwen3-vl:8b';
const routerModel = process.env.ROUTER_MODEL ||
  process.env.OLLAMA_ROUTER_MODEL ||
  plannerModel ||
  ollamaVisionModel ||
  'qwen3-vl:8b';
const orchestratorModel = process.env.ORCHESTRATOR_MODEL || null;
const generalModel = process.env.GENERAL_MODEL || ollamaModel;
const medicalVisionModel = process.env.MEDICAL_VISION_MODEL || 'llava-med-v1.6';
const medicalAnalysisModel = process.env.MEDICAL_ANALYSIS_MODEL || 'medtext-llama3';
const medicalRadiologyModel = process.env.MEDICAL_RADIOLOGY_MODEL || 'llava-med-v1.6';
const financialAnalysisModel = process.env.FINANCIAL_ANALYSIS_MODEL || 'fino1-8b';
// New: FINANCIAL_REASONING_MODEL prefers specialized text-reasoning models; fall back to the old var for compatibility
const financialReasoningModel = process.env.FINANCIAL_REASONING_MODEL || process.env.FINANCIAL_ANALYSIS_MODEL || 'llm-pro-finance-8b';
const financialVisionModel = process.env.FINANCIAL_VISION_MODEL || 'llm-pro-finance-8b';
const financialVatExpertModel = process.env.FINANCIAL_VAT_EXPERT || 'llm-pro-finance-8b';
const legalVisionModel = process.env.LEGAL_VISION_MODEL || ollamaVisionModel;
const legalAnalysisModel = process.env.LEGAL_ANALYSIS_MODEL || 'gpt-oss';
const legalOrchestratorModel = process.env.LEGAL_ORCHESTRATOR_MODEL || orchestratorModel;

const baseTokenLimit = parseEnvInt(process.env.TOKEN_LIMIT, 128000);
const baseResponseTokens = parseEnvInt(process.env.RESPONSE_TOKENS, 4096);
const ollamaTextContextWindow = parseEnvInt(process.env.OLLAMA_CONTEXT_WINDOW, baseTokenLimit);
const ollamaTextMaxResponseTokens = parseEnvInt(process.env.OLLAMA_MAX_RESPONSE_TOKENS, baseResponseTokens);
const ollamaVisionContextWindow = parseEnvInt(process.env.OLLAMA_VISION_CONTEXT_WINDOW, ollamaTextContextWindow);
const ollamaVisionMaxResponseTokens = parseEnvInt(process.env.OLLAMA_VISION_MAX_RESPONSE_TOKENS, 2048);
const ollamaPlannerContextWindow = parseEnvInt(process.env.OLLAMA_PLANNER_CONTEXT_WINDOW, ollamaVisionContextWindow);
const ollamaPlannerMaxResponseTokens = parseEnvInt(process.env.OLLAMA_PLANNER_MAX_RESPONSE_TOKENS, 700);
const ollamaExpertContextWindow = parseEnvInt(process.env.OLLAMA_EXPERT_CONTEXT_WINDOW, ollamaTextContextWindow);
const ollamaExpertMaxResponseTokens = parseEnvInt(process.env.OLLAMA_EXPERT_MAX_RESPONSE_TOKENS, ollamaTextMaxResponseTokens);
const ollamaVisionImageTokenOverhead = parseEnvInt(process.env.OLLAMA_VISION_IMAGE_TOKENS, 1024);
const translationContextWindow = parseEnvInt(process.env.TRANSLATION_CONTEXT_WINDOW, ollamaTextContextWindow);
const ollamaModelLimitsOverrides = parseEnvJson(process.env.OLLAMA_MODEL_LIMITS_JSON, {});
const qwenRouterHardeningEnabled = parseEnvBoolean(
  process.env.QWEN_ROUTER_HARDENING_ENABLED,
  'yes'
);
const qwenRouterTruncationThreshold = Number.parseFloat(
  process.env.QWEN_ROUTER_TRUNCATION_THRESHOLD || '0.02'
);
// Increased token budgets for qwen3-vl:8b (128K context allows more tokens)
const qwenRouterThinkingTokens = parseEnvInt(
  process.env.QWEN_ROUTER_THINKING_TOKENS,
  1024  // Was 256 - too low, caused truncation
);
const qwenRouterOutputTokens = parseEnvInt(
  process.env.QWEN_ROUTER_OUTPUT_TOKENS,
  512   // Was 256 - too low, caused truncation
);
const qwenRouterStopSequences = parseEnvJson(
  process.env.QWEN_ROUTER_STOP_SEQUENCES,
  ['\nEND_JSON']
);
const defaultOllamaModelLimits = {};
const defaultTextLimits = {
  contextWindow: ollamaTextContextWindow,
  maxResponseTokens: ollamaTextMaxResponseTokens
};
const defaultVisionLimits = {
  contextWindow: ollamaVisionContextWindow,
  maxResponseTokens: ollamaVisionMaxResponseTokens
};
const defaultPlannerLimits = {
  contextWindow: ollamaPlannerContextWindow,
  maxResponseTokens: ollamaPlannerMaxResponseTokens
};
const defaultExpertLimits = {
  contextWindow: ollamaExpertContextWindow,
  maxResponseTokens: ollamaExpertMaxResponseTokens
};

setModelLimit(defaultOllamaModelLimits, ollamaModel, 'text', defaultTextLimits);
setModelLimit(defaultOllamaModelLimits, generalModel, 'text', defaultTextLimits);
setModelLimit(defaultOllamaModelLimits, ollamaVisionModel, 'vision', defaultVisionLimits);
setModelLimit(defaultOllamaModelLimits, plannerModel, 'planner', defaultPlannerLimits);
setModelLimit(defaultOllamaModelLimits, routerModel, 'expert', defaultExpertLimits);
setModelLimit(defaultOllamaModelLimits, orchestratorModel, 'expert', defaultExpertLimits);
setModelLimit(defaultOllamaModelLimits, medicalVisionModel, 'vision', defaultVisionLimits);
setModelLimit(defaultOllamaModelLimits, medicalAnalysisModel, 'expert', defaultExpertLimits);
setModelLimit(defaultOllamaModelLimits, medicalRadiologyModel, 'vision', defaultVisionLimits);
setModelLimit(defaultOllamaModelLimits, financialVisionModel, 'vision', defaultVisionLimits);
setModelLimit(defaultOllamaModelLimits, financialAnalysisModel, 'expert', defaultExpertLimits);
setModelLimit(defaultOllamaModelLimits, financialVatExpertModel, 'expert', defaultExpertLimits);
setModelLimit(defaultOllamaModelLimits, legalVisionModel, 'vision', defaultVisionLimits);
setModelLimit(defaultOllamaModelLimits, legalAnalysisModel, 'expert', defaultExpertLimits);
setModelLimit(defaultOllamaModelLimits, legalOrchestratorModel, 'expert', defaultExpertLimits);
const ollamaModelLimits = mergeModelLimits(defaultOllamaModelLimits, ollamaModelLimitsOverrides);

// Initialize limit functions with defaults
const limitFunctions = {
  activateTagging: parseEnvBoolean(process.env.ACTIVATE_TAGGING, 'yes'),
  activateCorrespondents: parseEnvBoolean(process.env.ACTIVATE_CORRESPONDENTS, 'yes'),
  activateDocumentType: parseEnvBoolean(process.env.ACTIVATE_DOCUMENT_TYPE, 'yes'),
  activateTitle: parseEnvBoolean(process.env.ACTIVATE_TITLE, 'yes'),
  activateCustomFields: parseEnvBoolean(process.env.ACTIVATE_CUSTOM_FIELDS, 'yes')
};

// Initialize AI restrictions with defaults
const aiRestrictions = {
  restrictToExistingTags: parseEnvBoolean(process.env.RESTRICT_TO_EXISTING_TAGS, 'no'),
  restrictToExistingCorrespondents: parseEnvBoolean(process.env.RESTRICT_TO_EXISTING_CORRESPONDENTS, 'no'),
  restrictToExistingDocumentTypes: parseEnvBoolean(process.env.RESTRICT_TO_EXISTING_DOCUMENT_TYPES, 'no')
};

const orchestratorToolsEnabled = parseEnvBoolean(
  process.env.ORCHESTRATOR_TOOLS_ENABLED,
  'no'
);
const orchestratorPreVisionToolsEnabled = parseEnvBoolean(
  process.env.ORCHESTRATOR_PREVISION_TOOLS_ENABLED,
  orchestratorToolsEnabled
);
const orchestratorPreVisionNormalizationEnabled = parseEnvBoolean(
  process.env.ORCHESTRATOR_PREVISION_NORMALIZATION_ENABLED,
  orchestratorPreVisionToolsEnabled
);
const orchestratorPostAnalysisToolsEnabled = parseEnvBoolean(
  process.env.ORCHESTRATOR_POST_ANALYSIS_TOOLS_ENABLED,
  orchestratorToolsEnabled
);
const orchestratorFailOnToolError = parseEnvBoolean(
  process.env.ORCHESTRATOR_TOOL_FAIL_PIPELINE,
  'no'
);
const orchestratorToolAllowlist = parseEnvJson(
  process.env.ORCHESTRATOR_TOOL_ALLOWLIST_JSON,
  null
);

console.log('Loaded restriction settings:', {
  RESTRICT_TO_EXISTING_TAGS: aiRestrictions.restrictToExistingTags,
  RESTRICT_TO_EXISTING_CORRESPONDENTS: aiRestrictions.restrictToExistingCorrespondents,
  RESTRICT_TO_EXISTING_DOCUMENT_TYPES: aiRestrictions.restrictToExistingDocumentTypes
});

// Initialize external API configuration
const externalApiConfig = {
  enabled: parseEnvBoolean(process.env.EXTERNAL_API_ENABLED, 'no'),
  url: process.env.EXTERNAL_API_URL || '',
  method: process.env.EXTERNAL_API_METHOD || 'GET',
  headers: process.env.EXTERNAL_API_HEADERS || '{}',
  body: process.env.EXTERNAL_API_BODY || '{}',
  timeout: parseInt(process.env.EXTERNAL_API_TIMEOUT || '5000', 10),
  transformationTemplate: process.env.EXTERNAL_API_TRANSFORM || ''
};

console.log('Loaded environment variables:', {
  PAPERLESS_API_URL: process.env.PAPERLESS_API_URL,
  PAPERLESS_API_TOKEN: '******',
  LIMIT_FUNCTIONS: limitFunctions,
  AI_RESTRICTIONS: aiRestrictions,
  EXTERNAL_API: externalApiConfig.enabled === 'yes' ? 'enabled' : 'disabled'
});

module.exports = {
  PAPERLESS_AI_VERSION: '3.0.9',
  CONFIGURED: false,
  disableAutomaticProcessing: process.env.DISABLE_AUTOMATIC_PROCESSING || 'no',
  predefinedMode: process.env.PROCESS_PREDEFINED_DOCUMENTS,
  tokenLimit: baseTokenLimit,
  responseTokens: baseResponseTokens,
  addAIProcessedTag: process.env.ADD_AI_PROCESSED_TAG || 'no',
  addAIProcessedTags: process.env.AI_PROCESSED_TAG_NAME || 'ai-processed',
  // AI restrictions config
  restrictToExistingTags: aiRestrictions.restrictToExistingTags,
  restrictToExistingCorrespondents: aiRestrictions.restrictToExistingCorrespondents,
  restrictToExistingDocumentTypes: aiRestrictions.restrictToExistingDocumentTypes,
  // External API config
  externalApiConfig: externalApiConfig,
  paperless: {
    apiUrl: process.env.PAPERLESS_API_URL,
    apiToken: process.env.PAPERLESS_API_TOKEN
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  ollama: {
    apiUrl: process.env.OLLAMA_API_URL || 'http://localhost:11434',
    model: ollamaModel,
    repairModel: process.env.OLLAMA_REPAIR_MODEL || ollamaModel,
    visionModel: ollamaVisionModel,
    plannerModel,
    routerModel,
    orchestratorModel,
    visionKeepAlive: process.env.VISION_KEEP_ALIVE || '5m',
    textKeepAlive: process.env.TEXT_KEEP_ALIVE || '2m',
    routerKeepAlive: process.env.ROUTER_KEEP_ALIVE || '5m',
    qwenRouterHardening: {
      enabled: qwenRouterHardeningEnabled,
      truncationThreshold: Number.isFinite(qwenRouterTruncationThreshold)
        ? qwenRouterTruncationThreshold
        : 0.02,
      thinkingTokens: qwenRouterThinkingTokens,
      outputTokens: qwenRouterOutputTokens,
      stopSequences: Array.isArray(qwenRouterStopSequences)
        ? qwenRouterStopSequences
        : ['\nEND_JSON']
    },
    limits: {
      text: {
        contextWindow: ollamaTextContextWindow,
        maxResponseTokens: ollamaTextMaxResponseTokens
      },
      vision: {
        contextWindow: ollamaVisionContextWindow,
        maxResponseTokens: ollamaVisionMaxResponseTokens
      },
      planner: {
        contextWindow: ollamaPlannerContextWindow,
        maxResponseTokens: ollamaPlannerMaxResponseTokens
      },
      expert: {
        contextWindow: ollamaExpertContextWindow,
        maxResponseTokens: ollamaExpertMaxResponseTokens
      },
      imageTokenOverhead: ollamaVisionImageTokenOverhead
    },
    modelLimits: ollamaModelLimits
  },
  expertModels: {
    medical: {
      vision: medicalVisionModel,
      analysis: medicalAnalysisModel,
      radiology: medicalRadiologyModel
    },
    financial: {
      analysis: financialAnalysisModel,
      vision: financialVisionModel,
      vatExpert: financialVatExpertModel
    },
    legal: {
      vision: legalVisionModel,
      analysis: legalAnalysisModel,
      orchestrator: legalOrchestratorModel
    }
  },
  expertPipelineEnabled: parseEnvBoolean(process.env.EXPERT_PIPELINE_ENABLED, 'yes'),
  vatRag: {
    corpusPath: path.join(currentDir, 'data', 'austrian_vat')
  },
  legalRag: {
    corpusPath: path.join(currentDir, 'data', 'legal_corpus')
  },
  custom: {
    apiUrl: process.env.CUSTOM_BASE_URL || '',
    apiKey: process.env.CUSTOM_API_KEY || '',
    model: process.env.CUSTOM_MODEL || ''
  },
  azure: {
    apiKey: process.env.AZURE_API_KEY || '',
    endpoint: process.env.AZURE_ENDPOINT || '',
    deploymentName: process.env.AZURE_DEPLOYMENT_NAME || '',
    apiVersion: process.env.AZURE_API_VERSION || '2023-05-15'
  },
  customFields: process.env.CUSTOM_FIELDS || '',
  aiProvider: process.env.AI_PROVIDER || 'openai',
  scanInterval: process.env.SCAN_INTERVAL || '*/30 * * * *',
  useExistingData: process.env.USE_EXISTING_DATA || 'no',
  // Visual RAG configuration
  visualRag: {
    enabled: parseEnvBoolean(process.env.ENABLE_VISUAL_RAG, 'no'),
    textQualityThreshold: parseInt(process.env.TEXT_QUALITY_THRESHOLD || '60', 10),
    forceVision: parseEnvBoolean(process.env.FORCE_VISUAL_RAG, 'no'),
    visionRenderDpi: parseInt(process.env.VISION_RENDER_DPI || '300', 10),
    // Analysis DPI for geometry detection (rotation/crop) - defaults to visionRenderDpi
    analysisRenderDpi: parseInt(
      process.env.ANALYSIS_RENDER_DPI || process.env.VISION_RENDER_DPI || '300',
      10
    ),
    maxVisionPages: parseInt(process.env.MAX_VISION_PAGES || '4', 10),
    maxRetriesPlanner: parseInt(process.env.VISUAL_RAG_MAX_RETRIES_PLANNER || '1', 10),
    maxRetriesExtractor: parseInt(process.env.VISUAL_RAG_MAX_RETRIES_EXTRACTOR || '1', 10)
  },
  // Visual RAG Sidecar configuration (Tomoro/ColQwen2)
  visualRagSidecar: {
    enabled: parseEnvBoolean(process.env.ENABLE_VISUAL_RAG_SIDECAR, 'no'),
    url: process.env.VISUAL_RAG_URL || 'http://visual-rag:8001',
    timeout: parseInt(process.env.VISUAL_RAG_TIMEOUT || '30000', 10),
    enableOverlayExtraction: parseEnvBoolean(process.env.ENABLE_OVERLAY_EXTRACTION, 'yes'),
    parallelIngestion: parseEnvBoolean(process.env.VISUAL_RAG_PARALLEL_INGESTION, 'yes')
  },
  // Visual OCR configuration (qwen3-vl:8b text extraction)
  visualOCR: {
    enabled: parseEnvBoolean(process.env.VIS_OCR_ENABLED, 'yes'),
    timeout: parseInt(process.env.VIS_OCR_TIMEOUT || '60000', 10),
    maxPages: parseInt(process.env.VIS_OCR_MAX_PAGES || '20', 10),
    minQuality: parseFloat(process.env.VIS_OCR_MIN_QUALITY || '0.6'),
    embeddingModel: process.env.VIS_OCR_EMBEDDING_MODEL || 'nomic-embed-text-v1.5'
  },
  // MoE Retrieval configuration (Mixture of Experts routing)
  moeRetrieval: {
    enabled: parseEnvBoolean(process.env.MOE_RETRIEVAL_ENABLED, 'yes'),
    minQualityScore: parseFloat(process.env.MOE_MIN_QUALITY || '0.7'),
    expertWeights: {
      financial: parseFloat(process.env.MOE_WEIGHT_FINANCIAL || '1.0'),
      medical: parseFloat(process.env.MOE_WEIGHT_MEDICAL || '1.0'),
      legal: parseFloat(process.env.MOE_WEIGHT_LEGAL || '1.0'),
      general: parseFloat(process.env.MOE_WEIGHT_GENERAL || '0.8')
    }
  },
  // Guidance Service configuration (deterministic JSON extraction)
  guidanceService: {
    enabled: parseEnvBoolean(process.env.GUIDANCE_SERVICE_ENABLED, 'yes'),
    url: process.env.GUIDANCE_SERVICE_URL || 'http://localhost:8002',
    model: process.env.GUIDANCE_MODEL || 'sauerkraut-llama3.1:8b',
    timeout: parseInt(process.env.GUIDANCE_TIMEOUT || '90000', 10),
    useCache: parseEnvBoolean(process.env.GUIDANCE_USE_CACHE, 'yes'),
    maxRetries: parseInt(process.env.GUIDANCE_MAX_RETRIES || '2', 10),
    tagSchemaVersion: process.env.GUIDANCE_TAG_SCHEMA_VERSION || 'v1'
  },
  orchestration: {
    toolsEnabled: orchestratorToolsEnabled,
    preVisionToolsEnabled: orchestratorPreVisionToolsEnabled,
    postAnalysisToolsEnabled: orchestratorPostAnalysisToolsEnabled,
    preVisionNormalizationEnabled: orchestratorPreVisionNormalizationEnabled,
    failOnToolError: orchestratorFailOnToolError,
    toolAllowlist: orchestratorToolAllowlist
  },
  translation: {
    model: process.env.TRANSLATION_MODEL || process.env.OLLAMA_MODEL || 'sauerkraut-llama3.1:8b',
    timeout: parseInt(process.env.TRANSLATION_TIMEOUT || '60000', 10),
    maxTokens: parseInt(process.env.TRANSLATION_MAX_TOKENS || '512', 10),
    temperature: parseFloat(process.env.TRANSLATION_TEMPERATURE || '0.1'),
    minChars: parseInt(process.env.TRANSLATION_MIN_CHARS || '3', 10),
    contextWindow: translationContextWindow
  },
  ocrCheckpoint: {
    enabled: parseEnvBoolean(process.env.OCR_CHECKPOINT_ENABLED, 'yes'),
    includeTranslations: parseEnvBoolean(process.env.OCR_CHECKPOINT_TRANSLATIONS_ENABLED, 'yes'),
    maxRetries: parseEnvInt(process.env.OCR_CHECKPOINT_MAX_RETRIES, 3),
    retryDelay: parseEnvInt(process.env.OCR_CHECKPOINT_RETRY_DELAY, 1000),
    required: parseEnvBoolean(process.env.OCR_CHECKPOINT_REQUIRED, 'no'),
    continueOnPartialSuccess: parseEnvBoolean(process.env.OCR_CHECKPOINT_CONTINUE_ON_PARTIAL_SUCCESS, 'yes')
  },
  summaryFallback: {
    enabled: parseEnvBoolean(process.env.SUMMARY_FALLBACK_ENABLED, 'yes'),
    maxInputTokens: parseInt(process.env.SUMMARY_FALLBACK_MAX_INPUT_TOKENS || '4000', 10),
    maxSummaryTokens: parseInt(process.env.SUMMARY_FALLBACK_MAX_SUMMARY_TOKENS || '512', 10),
    timeout: parseInt(process.env.SUMMARY_FALLBACK_TIMEOUT || '60000', 10),
    temperature: parseFloat(process.env.SUMMARY_FALLBACK_TEMPERATURE || '0.1'),
    model: process.env.SUMMARY_FALLBACK_MODEL || process.env.OLLAMA_MODEL || 'sauerkraut-llama3.1:8b'
  },
  semanticRouter: {
    enabled: parseEnvBoolean(process.env.SEMANTIC_ROUTER_ENABLED, 'no'),
    minConfidence: parseFloat(process.env.SEMANTIC_ROUTER_MIN_CONFIDENCE || '0.6'),
    costWeights: {
      expert: parseFloat(process.env.SEMANTIC_ROUTER_WEIGHT_EXPERT || '1.0'),
      general: parseFloat(process.env.SEMANTIC_ROUTER_WEIGHT_GENERAL || '0.5'),
      router: parseFloat(process.env.SEMANTIC_ROUTER_WEIGHT_ROUTER || '0.2')
    }
  },
  // Router retry and model-availability configuration
  routerRetry: {
    maxRetries: parseEnvInt(process.env.ROUTER_MAX_RETRIES, 3),
    baseDelay: parseEnvInt(process.env.ROUTER_RETRY_BASE_DELAY, 1000),
    maxDelay: parseEnvInt(process.env.ROUTER_RETRY_MAX_DELAY, 10000),
    enableModelCheck: parseEnvBoolean(process.env.ROUTER_ENABLE_MODEL_CHECK, 'yes'),
    modelCheckTimeout: parseEnvInt(process.env.ROUTER_MODEL_CHECK_TIMEOUT, 5000)
  },
  // PostgreSQL configuration for visual overlays
  postgres: {
    host: process.env.POSTGRES_HOST || process.env.PAPERLESS_DBHOST || 'db',
    port: parseInt(process.env.POSTGRES_PORT || process.env.PAPERLESS_DBPORT || '5432', 10),
    database: process.env.POSTGRES_DB || process.env.PAPERLESS_DBNAME || 'paperless',
    user: process.env.POSTGRES_USER || process.env.PAPERLESS_DBUSER,
    password: process.env.POSTGRES_PASSWORD || process.env.PAPERLESS_DBPASS
  },
  duplicateDetection: {
    enabled: parseEnvBoolean(process.env.DUPLICATE_DETECTION_ENABLED, 'yes'),
    similarityThreshold: parseFloat(process.env.DUPLICATE_SIMILARITY_THRESHOLD || '0.95'),
    maxPagesToCompare: parseInt(process.env.DUPLICATE_MAX_PAGES || '10', 10),
    duplicateAction: process.env.DUPLICATE_ACTION || 'skip',
    duplicateTagName: process.env.DUPLICATE_TAG_NAME || 'duplicate',
    duplicateArchiveMode: process.env.DUPLICATE_ARCHIVE_MODE || 'remove_tag',
    duplicateArchiveTagName: process.env.DUPLICATE_ARCHIVE_TAG_NAME || 'Inbox',
    duplicateArchiveStoragePathId: process.env.DUPLICATE_ARCHIVE_STORAGE_PATH_ID
      ? parseInt(process.env.DUPLICATE_ARCHIVE_STORAGE_PATH_ID, 10)
      : null,
    duplicateMergeDeleteOriginals: parseEnvBoolean(process.env.DUPLICATE_MERGE_DELETE_ORIGINALS, 'yes')
  },
  // Add limit functions to config
  limitFunctions: {
    activateTagging: limitFunctions.activateTagging,
    activateCorrespondents: limitFunctions.activateCorrespondents,
    activateDocumentType: limitFunctions.activateDocumentType,
    activateTitle: limitFunctions.activateTitle,
    activateCustomFields: limitFunctions.activateCustomFields
  },
  specialPromptPreDefinedTags: `You are a document analysis AI. You will analyze the document. 
  You take the main information to associate tags with the document. 
  You will also find the correspondent of the document (Sender not receiver). Also you find a meaningful and short title for the document.
  You are given a list of tags: ${process.env.PROMPT_TAGS}
  Only use the tags from the list and try to find the best fitting tags.
  You do not ask for additional information, you only use the information given in the document.
  
  Return the result EXCLUSIVELY as a JSON object. The Tags and Title MUST be in the language that is used in the document.:
  {
    "title": "xxxxx",
    "correspondent": "xxxxxxxx",
    "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
    "document_date": "YYYY-MM-DD",
    "language": "en/de/es/..."
  }`,
  mustHavePrompt: `  Return the result EXCLUSIVELY as a JSON object. The Tags, Title and Document_Type MUST be in the language that is used in the document.:
  IMPORTANT: The custom_fields are optional and can be left out if not needed, only try to fill out the values if you find a matching information in the document.
  custom_fields keys are fixed IDs; do not invent or rename keys. Use null when unknown. If the field is about money only add the number without currency and always use a . for decimal places.
  {
    "title": "xxxxx",
    "correspondent": "xxxxxxxx",
    "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
    "document_type": "Invoice/Contract/...",
    "document_date": "YYYY-MM-DD",
    "language": "en/de/es/...",
    %CUSTOMFIELDS%
  }`,
  // Model aliases for backward compatibility and flexibility
  modelAliases: {
    // Production tier - Medical models
    'llava-med': 'llava-med-v1.6',
    'llava-med-v1.6:latest': 'llava-med-v1.6',
    'llava-med-v1.5': 'llava-med-v1.6',
    'llava-med-v1.5:latest': 'llava-med-v1.6',
    'medtext': 'medtext-llama3',
    'medtext-llama3:latest': 'medtext-llama3',
    
    // Production tier - Financial models
    'fino1': 'fino1-8b',
    'fino1-8b-q8': 'fino1-8b',
    'fino1-8b:latest': 'fino1-8b',
    'llm-pro-finance': 'llm-pro-finance-8b',
    'llm-pro-finance-8b:latest': 'llm-pro-finance-8b',
    
    // Production tier - General models
    'sauerkraut': 'sauerkraut-llama3.1:8b',
    'llama3': 'llama3.2:latest',
    'llama3.2': 'llama3.2:latest',
    'llama3.1': 'sauerkraut-llama3.1:8b',
    
    // Production tier - Router
    'qwen3-vl': 'qwen3-vl:8b',
    'qwen3-vl:8B': 'qwen3-vl:8b',  // Case normalization
    
    // Advanced tier - Reasoning models
    'dragon': 'llm-pro-finance-8b',
    'dragon-llm': 'llm-pro-finance-8b',
    'gpt-oss:20b': 'gpt-oss',
    'gpt-oss-20b': 'gpt-oss',
    
    // Infrastructure tier - Orchestration
    'nemotron': 'nemotron-orchestrator:8b',
    'orchestrator': 'nemotron-orchestrator:8b',
    
    // Infrastructure tier - Embeddings
    'nomic-embed': 'nomic-embed-text-v1.5',
    'tomoro': 'tomoro-colqwen3-embed-8b',
    'colqwen3': 'tomoro-colqwen3-embed-8b'
  }
};

/**
 * Validate required database credentials
 * Throws error with helpful message if credentials are missing
 */
function validateDatabaseCredentials() {
  const requiredVars = [
    { key: 'POSTGRES_USER', fallback: 'PAPERLESS_DBUSER', value: process.env.POSTGRES_USER || process.env.PAPERLESS_DBUSER },
    { key: 'POSTGRES_PASSWORD', fallback: 'PAPERLESS_DBPASS', value: process.env.POSTGRES_PASSWORD || process.env.PAPERLESS_DBPASS },
    { key: 'POSTGRES_DB', fallback: 'PAPERLESS_DBNAME', value: process.env.POSTGRES_DB || process.env.PAPERLESS_DBNAME }
  ];

  const missing = [];
  for (const varInfo of requiredVars) {
    if (!varInfo.value || varInfo.value === '') {
      missing.push(`${varInfo.key} (or ${varInfo.fallback})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[CONFIG] Missing required database credentials: ${missing.join(', ')}\n` +
      `Please ensure these variables are set in docker-compose.env:\n` +
      `  - POSTGRES_USER=<username>\n` +
      `  - POSTGRES_PASSWORD=<password>\n` +
      `  - POSTGRES_DB=<database_name>`
    );
  }
}

// Run validation immediately
validateDatabaseCredentials();

/**
 * Log environment variable resolution for debugging
 * Shows which variable name was used and its source
 */
function logEnvResolution(canonicalKey, fallbackKeys = []) {
  const canonicalValue = process.env[canonicalKey];
  let source = null;
  let value = canonicalValue;

  if (canonicalValue) {
    source = canonicalKey;
  } else {
    for (const fallbackKey of fallbackKeys) {
      const fallbackValue = process.env[fallbackKey];
      if (fallbackValue !== undefined && fallbackValue !== '') {
        source = fallbackKey;
        value = fallbackValue;
        break;
      }
    }
  }

  return { key: canonicalKey, source, value: value ? '******' : '<NOT SET>' };
}

// Log all database-related environment variables at startup
console.log('[CONFIG] Environment variable resolution:');
console.log('  Database User:', logEnvResolution('POSTGRES_USER', ['PAPERLESS_DBUSER']));
console.log('  Database Password:', logEnvResolution('POSTGRES_PASSWORD', ['PAPERLESS_DBPASS']));
console.log('  Database Name:', logEnvResolution('POSTGRES_DB', ['PAPERLESS_DBNAME']));
console.log('  Database Host:', logEnvResolution('POSTGRES_HOST', ['PAPERLESS_DBHOST']));
console.log('  Database Port:', logEnvResolution('POSTGRES_PORT', ['PAPERLESS_DBPORT']));

console.log('[CONFIG] Database configuration loaded:', {
  host: module.exports.postgres.host,
  port: module.exports.postgres.port,
  database: module.exports.postgres.database,
  user: module.exports.postgres.user,
  password: module.exports.postgres.password ? '******' : '<NOT SET>',
  source: {
    user: process.env.POSTGRES_USER ? 'POSTGRES_USER' : 'PAPERLESS_DBUSER',
    password: process.env.POSTGRES_PASSWORD ? 'POSTGRES_PASSWORD' : 'PAPERLESS_DBPASS',
    database: process.env.POSTGRES_DB ? 'POSTGRES_DB' : 'PAPERLESS_DBNAME',
    host: process.env.POSTGRES_HOST ? 'POSTGRES_HOST' : (process.env.PAPERLESS_DBHOST ? 'PAPERLESS_DBHOST' : 'default')
  }
});
