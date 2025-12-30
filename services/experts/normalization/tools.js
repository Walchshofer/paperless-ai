// Dependencies are injected into PreVisionNormalizer for testability.
// Import the class and the default singleton for backward compatibility.
const { PreVisionNormalizer, preVisionNormalizer } = require('./PreVisionNormalizer');
// Note: `runPaperlessTool` is required dynamically inside the function to avoid a circular require
const logger = require('../../logger');

/**
 * AI-driven document normalization tool
 * Analyzes document geometry using vision model, applies normalization, and re-ingests if needed
 */
// Thin wrapper delegating to the PreVisionNormalizer service


/**
 * Factory to create a normalization tool with injected dependencies.
 *
 * Example: const tool = createNormalizationTool({ paperlessService: mock, pdfRenderer: mock });
 */
function createNormalizationTool(deps = {}) {
    const normalizer = deps.preVisionNormalizer || preVisionNormalizer || new PreVisionNormalizer(deps);

    async function normalizeImagesAI(input = {}) {
        const { document_id } = input;

        if (!document_id) {
            throw new Error('document_id is required');
        }

        const docId = Number(document_id);
        if (!Number.isInteger(docId) || docId <= 0) {
            throw new Error('document_id must be a positive integer');
        }

        logger.info(`[NormalizationTool] Starting AI-driven normalization for doc ${docId}`);

        try {
            const result = await normalizer.analyzeAndNormalize(docId, deps);
            return result;
        } catch (error) {
            logger.error(`[NormalizationTool] Failed for doc ${docId}: ${error.message}`);
            throw error;
        }
    }

    return { normalizeImagesAI };
}

// Default export function for backward compatibility uses the singleton normalizer
async function normalizeImagesAI(input = {}) {
    const tool = createNormalizationTool();
    return tool.normalizeImagesAI(input);
}

/**
 * Parse geometry analysis JSON from Guidance/Ollama
 */
function _parseGeometryAnalysis(response) {
    try {
        let json = response;
        
        // Handle string response
        if (typeof response === 'string') {
            // Strip markdown code blocks
            let cleaned = response.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.split('\n').slice(1).join('\n');
                cleaned = cleaned.substring(0, cleaned.lastIndexOf('```'));
            }
            json = JSON.parse(cleaned);
        }

        // Validate required fields
        if (typeof json.rotate !== 'number' || ![0, 90, 180, 270].includes(json.rotate)) {
            json.rotate = 0;
        }
        if (typeof json.needs_crop !== 'boolean') {
            json.needs_crop = false;
        }
        if (typeof json.confidence !== 'number') {
            json.confidence = 0.5;
        }

        return json;
    } catch (err) {
        logger.error(`[NormalizationTool] Failed to parse analysis: ${err.message}`);
        return null;
    }
}

/**
 * Convert 0-1000 normalized coordinates to pixel coordinates
 */
function _denormalizeCoordinates(box, width, height) {
    if (!box || !Array.isArray(box) || box.length !== 4) {
        return null;
    }

    const [xmin, ymin, xmax, ymax] = box.map(c => Math.max(0, Math.min(1000, c)));

    return {
        x: Math.round((xmin / 1000) * width),
        y: Math.round((ymin / 1000) * height),
        width: Math.round(((xmax - xmin) / 1000) * width),
        height: Math.round(((ymax - ymin) / 1000) * height),
        unit: 'pixel'
    };
}

/**
 * Build normalization actions from geometry analysis
 */
function _buildNormalizationActions(analysis, pageInfo) {
    const actions = [];

    // Rotation action
    if (analysis.rotate && analysis.rotate !== 0) {
        actions.push({
            type: 'rotate',
            degrees: analysis.rotate
        });
    }

    // Crop action
    if (analysis.needs_crop && analysis.crop_box) {
        const cropBox = _denormalizeCoordinates(
            analysis.crop_box,
            pageInfo.width || 2480,  // Default A4 at 300 DPI
            pageInfo.height || 3508
        );

        if (cropBox && cropBox.width > 50 && cropBox.height > 50) {
            actions.push({
                type: 'crop',
                box: cropBox
            });
        }
    }

    // DPI action
    if (analysis.target_dpi && analysis.target_dpi > 0) {
        actions.push({
            type: 'dpi',
            target: analysis.target_dpi
        });
    }

    return actions;
}

/**
 * Determine if document should be re-ingested after normalization
 */
function _shouldReingest(analysis, actions) {
    // Re-ingest if rotation was applied
    if (actions.some(a => a.type === 'rotate' && a.degrees !== 0)) {
        return true;
    }

    // Re-ingest if significant cropping (>10% area reduction)
    const cropAction = actions.find(a => a.type === 'crop');
    if (cropAction) {
        // Estimate area reduction (simplified)
        return true;
    }

    // Re-ingest if DPI changed significantly
    if (actions.some(a => a.type === 'dpi')) {
        return true;
    }

    return false;
}

/**
 * Fallback vision analysis using direct Ollama call
 */
async function _fallbackVisionAnalysis(base64Image, prompt) {
    // Try to call Ollama directly; if unavailable or fails, return null to allow no-op
    try {
        if (!base64Image) {
            logger.warn('[NormalizationTool] No image provided for fallback analysis');
            return null;
        }

        const ollamaService = require('../../ollamaService');
        const { extractJsonFromResponse } = require('../../ollama/utils');

        if (!ollamaService || typeof ollamaService._callOllamaVisionAPI !== 'function') {
            logger.warn('[NormalizationTool] Ollama service not available for fallback');
            return null;
        }

        const response = await ollamaService._callOllamaVisionAPI(prompt, base64Image);
        const json = extractJsonFromResponse(response?.response || response?.response?.toString?.() || '');
        if (!json) {
            logger.warn('[NormalizationTool] Ollama fallback did not return valid JSON');
            return null;
        }
        return json;
    } catch (err) {
        logger.warn(`[NormalizationTool] Fallback vision analysis failed: ${err.message}`);
        return null;
    }
}

module.exports = {
    normalizeImagesAI,
    _denormalizeCoordinates,
    _parseGeometryAnalysis,
    _buildNormalizationActions,
    _shouldReingest,
    _fallbackVisionAnalysis
};
