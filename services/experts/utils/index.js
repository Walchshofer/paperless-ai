/**
 * utils/index.js
 *
 * Central export point for utility modules.
 * Provides unified access to all pipeline utility functions.
 */

// Import specific loaders
const { getVisualRagModules } = require('./visualRagLoader');

module.exports = {
    // Visual RAG Loader
    getVisualRagModules,

    // Normalizers
    normalizeLanguageHint: require('./normalizers').normalizeLanguageHint,
    normalizeBoolean: require('./normalizers').normalizeBoolean,
    resolveDocumentImages: require('./normalizers').resolveDocumentImages,

    // Tooling Configuration
    ...require('./toolingConfig'),

    // Tool Calls
    ...require('./toolCalls'),

    // Guidance
    ...require('./guidance'),

    // OCR Quality
    ...require('./ocrQuality'),

    // OCR Metadata
    ...require('./ocrMetadata'),

    // Tooling Execution
    ...require('./toolingExecution')
};

