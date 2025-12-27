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
  tokenLimit: process.env.TOKEN_LIMIT || 128000,
  responseTokens: process.env.RESPONSE_TOKENS || 1000,
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
    model: process.env.OLLAMA_MODEL || 'sauerkraut-llama3.1:8b',
    repairModel: process.env.OLLAMA_REPAIR_MODEL || 'sauerkraut-llama3.1:8b',
    visionModel: process.env.OLLAMA_VISION_MODEL || 'qwen3-vl:8b',
    visionKeepAlive: process.env.VISION_KEEP_ALIVE || '5m',
    textKeepAlive: process.env.TEXT_KEEP_ALIVE || '2m',
    routerKeepAlive: process.env.ROUTER_KEEP_ALIVE || '5m'
  },
  expertModels: {
    medical: {
      vision: process.env.MEDICAL_VISION_MODEL || 'llava-med-v1.5',
      analysis: process.env.MEDICAL_ANALYSIS_MODEL || 'medtext-llama3'
    },
    financial: {
      analysis: process.env.FINANCIAL_ANALYSIS_MODEL || 'fino1-8b',
      vatExpert: process.env.FINANCIAL_VAT_EXPERT || 'dragon-finance:latest'
    },
    legal: {
      analysis: process.env.LEGAL_ANALYSIS_MODEL || 'dragon-finance:latest',
      orchestrator: process.env.LEGAL_ORCHESTRATOR_MODEL || 'nemotron-manager:latest'
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
  // PostgreSQL configuration for visual overlays
  postgres: {
    host: process.env.POSTGRES_HOST || process.env.PAPERLESS_DBHOST || 'db',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'paperless',
    user: process.env.POSTGRES_USER || 'paperless',
    password: process.env.POSTGRES_PASSWORD || ''
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
    'llava-med': 'llava-med-v1.5',
    'llava-med-v1.5:latest': 'llava-med-v1.5',
    'medtext': 'medtext-llama3',
    'medtext-llama3:latest': 'medtext-llama3',
    
    // Production tier - Financial models
    'fino1': 'fino1-8b',
    'fino1-8b-q8': 'fino1-8b',
    'llm-pro-finance': 'llm-pro-finance-8b',
    
    // Production tier - General models
    'sauerkraut': 'sauerkraut-llama3.1:8b',
    'llama3': 'llama3.2:latest',
    'llama3.2': 'llama3.2:latest',
    'llama3.1': 'sauerkraut-llama3.1:8b',
    
    // Production tier - Router
    'qwen3-vl': 'qwen3-vl:8b',
    'qwen3-vl:8B': 'qwen3-vl:8b',  // Case normalization
    
    // Advanced tier - Reasoning models
    'dragon': 'dragon-finance',
    'dragon-llm': 'dragon-finance',
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
