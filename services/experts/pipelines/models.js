/**
 * Model Configuration
 *
 * Defines model names for expert pipelines with environment variable overrides.
 */

const config = require('../../../config/config');

const MODEL_NAMES = Object.freeze({
    // Primary router/classifier model (multimodal)
    router: config.ollama?.routerModel || config.ollama?.visionModel || 'qwen3-vl:8b',

    // Vision model for visual analysis (qwen3-vl for multimodal)
    vision: process.env.OLLAMA_VISION_MODEL || config.ollama?.visionModel || 'qwen3-vl:8b',

    // Medical models: prefer explicit MEDICAL_* env vars, then config.expertModels entries, then ollama defaults
    medicalImaging: process.env.MEDICAL_VISION_MODEL || config.expertModels?.medical?.vision || config.ollama?.visionModel || 'llava-med-v1.6',
    medicalText: process.env.MEDICAL_ANALYSIS_MODEL || config.expertModels?.medical?.analysis || config.ollama?.model || 'medtext-llama3',
    medicalRadiology: process.env.MEDICAL_RADIOLOGY_MODEL || config.expertModels?.medical?.radiology || config.ollama?.visionModel || 'llava-med-v1.6',

    // Financial models: prefer FINANCIAL_* env vars, then config.expertModels entries, then finance defaults, then ollama defaults
    financeReasoning: process.env.FINANCIAL_ANALYSIS_MODEL || config.expertModels?.financial?.analysis || config.ollama?.model || 'fino1-8b',
    financeGeneral: process.env.FINANCIAL_VISION_MODEL || config.expertModels?.financial?.vision || config.ollama?.visionModel || 'llm-pro-finance-8b',
    vatExpert: process.env.VAT_EXPERT_MODEL ||
               process.env.FINANCIAL_VAT_EXPERT ||
               config.expertModels?.financial?.vatExpert ||
               process.env.FINANCIAL_VISION_MODEL ||
               config.expertModels?.financial?.vision ||
               config.ollama?.visionModel ||
               'llm-pro-finance-8b',

    // Legal expert mapping -> Dragon finance reasoning model
    legalExpert: process.env.LEGAL_EXPERT_MODEL ||
                 process.env.LEGAL_ANALYSIS_MODEL ||
                 config.expertModels?.legal?.analysis ||
                 'llm-pro-finance-8b',

    // Advanced tier - Reasoning models
    dragon: process.env.DRAGON_MODEL || null,
    gptOss: process.env.GPT_OSS_MODEL || null,

    // Infrastructure tier - Orchestration and embeddings
    orchestrator: process.env.ORCHESTRATOR_MODEL ||
        config.ollama?.orchestratorModel ||
        config.expertModels?.legal?.orchestrator ||
        null,
    embeddingModel: process.env.EMBEDDING_MODEL || 'nomic-embed-text-v1.5',
    visualRetrieval: process.env.VISUAL_RETRIEVAL_MODEL || null,

    // General fallback
    general: process.env.GENERAL_MODEL || config.ollama?.model || 'sauerkraut-llama3.1:8b'
});

module.exports = { MODEL_NAMES };
