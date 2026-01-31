const logger = require('../../logger');
const paperlessService = require('../../paperlessService');
const { ImageNormalizer } = require('../../visual-rag-client/ImageNormalizer');

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
// Factory to create a normalization tool with optional injected dependencies.
// This avoids top-level requires that cause circular dependencies: callers
// should call `createNormalizationTools({ preVisionNormalizer })` and use
// the returned `normalizeImagesAI` function. Helper utilities are exported
// as well for unit tests.
function createNormalizationTools(deps = {}) {
    const normalizer = deps.preVisionNormalizer || null;

    async function normalizeImagesAI(input = {}) {
        if (!input.document_id) {
            throw new Error('document_id is required');
        }
        const documentId = Number(input.document_id);
        if (!Number.isInteger(documentId) || documentId <= 0) {
            throw new Error('document_id must be a positive integer');
        }

        // If a PreVisionNormalizer instance is injected, prefer it for orchestration
        if (normalizer && typeof normalizer.analyzeAndNormalize === 'function') {
            // Delegate to the normalizer which contains orchestration logic
            return normalizer.analyzeAndNormalize(documentId, input);
        }

        // Fallback: run ImageNormalizer directly (stateless path)
        const pdfBuffer = await paperlessService.downloadOriginalDocument(documentId)
            || await paperlessService.downloadDocument(documentId);
        if (!pdfBuffer) {
            throw new Error(`Unable to download document ${documentId}`);
        }

        const normalized = await ImageNormalizer.normalizeBuffer(pdfBuffer, {
            actions: input.actions,
            target_dpi: input.target_dpi,
            max_pages: input.max_pages,
            pages: input.pages,
            page_range: input.page_range,
            format: input.format,
            docId: documentId,
            documentId
        });

        return {
            document_id: documentId,
            metadata: normalized.metadata || null,
            base64Images: normalized.base64Images || [],
            image_data: normalized.base64Images?.[0] || null
        };
    }

    return {
        normalizeImagesAI,
        _denormalizeCoordinates,
        _parseGeometryAnalysis,
        _buildNormalizationActions,
        _shouldReingest,
        _fallbackVisionAnalysis
    };
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
    createNormalizationTools,
    _denormalizeCoordinates,
    _parseGeometryAnalysis,
    _buildNormalizationActions,
    _shouldReingest,
    _fallbackVisionAnalysis
};
