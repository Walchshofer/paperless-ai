/**
 * Model Configuration
 *
 * Defines model names for expert pipelines with environment variable overrides.
 */

const config = require('../../../config/config');

const MODEL_NAMES = Object.freeze({
    // Primary orchestration/router model
    router: process.env.ROUTER_MODEL || config.ollama?.visionModel || 'nemotron-manager:latest',

    // Medical models: prefer explicit MEDICAL_* env vars, then config.expertModels entries, then ollama defaults
    medicalImaging: process.env.MEDICAL_VISION_MODEL || config.expertModels?.medical?.vision || config.ollama?.visionModel || 'llava-med-v1.5',
    medicalText: process.env.MEDICAL_ANALYSIS_MODEL || config.expertModels?.medical?.analysis || config.ollama?.model || 'medtext-llama3',
    medicalRadiology: process.env.MEDICAL_RADIOLOGY_MODEL || config.expertModels?.medical?.radiology || config.ollama?.visionModel || 'llava-med-v1.5',

    // Financial models: prefer FINANCIAL_* env vars, then config.expertModels entries, then finance defaults, then ollama defaults
    financeReasoning: process.env.FINANCIAL_ANALYSIS_MODEL || config.expertModels?.financial?.analysis || config.ollama?.model || 'fino1-8b',
    financeGeneral: process.env.FINANCIAL_VISION_MODEL || config.expertModels?.financial?.vision || config.ollama?.visionModel || 'llm-pro-finance-8b',
    vatExpert: process.env.VAT_EXPERT_MODEL || process.env.FINANCIAL_VISION_MODEL || config.expertModels?.financial?.vision || config.ollama?.visionModel || 'dragon-finance:latest',

    // Legal expert mapping -> Dragon finance reasoning model
    legalExpert: process.env.LEGAL_EXPERT_MODEL || 'dragon-finance:latest',

    // Advanced tier - Reasoning models
    dragon: process.env.DRAGON_MODEL || null,
    gptOss: process.env.GPT_OSS_MODEL || null,

    // Infrastructure tier - Orchestration and embeddings
    orchestrator: process.env.ORCHESTRATOR_MODEL || null,
    embeddingModel: process.env.EMBEDDING_MODEL || 'nomic-embed-text-v1.5',
    visualRetrieval: process.env.VISUAL_RETRIEVAL_MODEL || null,

    // General fallback
    general: process.env.GENERAL_MODEL || config.ollama?.model || 'sauerkraut-llama3.1:8b'
});

module.exports = { MODEL_NAMES };
