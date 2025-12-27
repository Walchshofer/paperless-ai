/**
 * Visual RAG Loader
 *
 * Provides lazy-loading of Visual RAG modules to allow graceful
 * degradation when the Visual RAG service is not available.
 */

const logger = require('../../logger');

let visualRagModules = null;

/**
 * Get Visual RAG modules with lazy loading
 * @returns {Object|null} Visual RAG modules or null if unavailable
 */
function getVisualRagModules() {
    if (visualRagModules === null) {
        try {
            visualRagModules = require('../../visual-rag');
        } catch (err) {
            logger.warn('[ExpertPipelineExecutor] Visual RAG modules not available:', err.message);
            visualRagModules = false;
        }
    }
    return visualRagModules || null;
}

module.exports = { getVisualRagModules };
