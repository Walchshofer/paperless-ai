const paperlessService = require('../../paperlessService');
const { pdfRenderer } = require('../../visual-rag/PDFRenderer');
const { guidanceClient } = require('../../guidance/GuidanceClient');
const { ingestionManager } = require('../../visual-rag/IngestionManager');
// Note: `runPaperlessTool` is required dynamically inside the function to avoid a circular require
const logger = require('../../logger');
const config = require('../../../config/config');
const fs = require('fs').promises;
const path = require('path');

/**
 * AI-driven document normalization tool
 * Analyzes document geometry using vision model, applies normalization, and re-ingests if needed
 */
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

    const result = {
        success: false,
        document_id: docId,
        normalized_pages: [],
        metadata: {
            actions_applied: [],
            changes_detected: false,
            reingested: false,
            warnings: []
        }
    };

    try {
        // Step 1: Download original document
        const pdfBuffer = await paperlessService.downloadOriginalDocument(docId)
            || await paperlessService.downloadDocument(docId);
        
        if (!pdfBuffer) {
            throw new Error(`Unable to download document ${docId}`);
        }

        // Step 2: Render first page for analysis (low DPI for speed)
        const analysisDpi = 150;
        const rendered = await pdfRenderer.renderBuffer(pdfBuffer, {
            dpi: analysisDpi,
            maxPages: 1,
            docId
        });

        if (!rendered || rendered.length === 0) {
            throw new Error('Failed to render document for analysis');
        }

        const analysisImage = rendered[0].base64;

        // Step 3: Load Guidance template
        const templatePath = path.join(process.cwd(), '.prompts', 'templates', 'normalization_guidance.md');
        let promptTemplate;
        try {
            promptTemplate = await fs.readFile(templatePath, 'utf-8');
        } catch (err) {
            result.metadata.warnings.push(`Template not found: ${err.message}`);
            logger.warn(`[NormalizationTool] Template not found, using fallback`);
            // Fallback: no normalization
            result.success = true;
            return result;
        }

        // Step 4: Call Guidance service for geometry analysis
        let geometryAnalysis;
        try {
            const guidanceResult = await guidanceClient.generate('normalization_geometry', {
                image: analysisImage,
                prompt: promptTemplate
            }, {
                model: config.ollama?.visionModel || 'qwen3-vl:8b',
                temperature: 0.1
            });

            geometryAnalysis = guidanceResult.generated;
        } catch (err) {
            logger.warn(`[NormalizationTool] Guidance analysis failed: ${err.message}`);
            // Fallback: try direct Ollama call
            geometryAnalysis = await _fallbackVisionAnalysis(analysisImage, promptTemplate);
        }

        // Step 5: Parse and validate analysis
        const analysis = _parseGeometryAnalysis(geometryAnalysis);
        
        if (!analysis || analysis.confidence < 0.5) {
            result.metadata.warnings.push('Low confidence analysis, skipping normalization');
            result.success = true;
            return result;
        }

        // Step 6: Convert analysis to normalization actions
        const actions = _buildNormalizationActions(analysis, rendered[0]);
        
        if (actions.length === 0) {
            logger.info(`[NormalizationTool] No normalization needed for doc ${docId}`);
            result.success = true;
            result.metadata.reasoning = analysis.reasoning;
            return result;
        }

        // Record metadata (wrap action params to match published output format)
        result.metadata.actions_applied = actions.map(a => ({
            type: a.type,
            params: Object.assign({},
                a.degrees !== undefined ? { degrees: a.degrees } : {},
                a.box ? { box: a.box } : {},
                a.target !== undefined ? { target: a.target } : {},
                a.scale !== undefined ? { scale: a.scale } : {},
                a.width !== undefined ? { width: a.width } : {},
                a.height !== undefined ? { height: a.height } : {}
            )
        }));
        result.metadata.changes_detected = true;

        // Step 7: Apply normalization using existing tool
        const targetDpi = analysis.target_dpi || config.visualRag?.visionRenderDpi || 300;
        const maxPages = config.visualRag?.maxVisionPages || 4;

        // Break cycle: require runPaperlessTool after a short tick so module.exports have been set
        await new Promise(resolve => setImmediate(resolve));
        const { runPaperlessTool } = require('../../tools/paperlessApiTools');

        const normalizeResult = await runPaperlessTool('paperless.normalize_images', {
            document_id: docId,
            actions,
            target_dpi: targetDpi,
            max_pages: maxPages,
            format: 'png'
        });

        if (!normalizeResult || !normalizeResult.base64Images) {
            throw new Error('Normalization failed');
        }

        // Step 8: Build normalized pages metadata
        result.normalized_pages = normalizeResult.base64Images.map((base64, idx) => ({
            page: idx + 1,
            base64,
            width: normalizeResult.metadata?.pages?.[idx]?.width || null,
            height: normalizeResult.metadata?.pages?.[idx]?.height || null
        }));

        // Step 9: Determine if re-ingestion is needed
        const shouldReingest = _shouldReingest(analysis, actions);

        if (shouldReingest) {
            logger.info(`[NormalizationTool] Re-ingesting doc ${docId} after normalization`);
            
            try {
                const doc = await paperlessService.getDocument(docId);

                // Build relative PDF path consistent with other ingestion flows
                const archiveName = doc?.archive_file_name || doc?.archive_filename;
                const originalName = doc?.original_file_name || doc?.originalFileName || null;
                let pdfPath;
                if (archiveName) {
                    pdfPath = `documents/archive/${archiveName}`;
                } else {
                    const fallbackName = originalName || `doc-${docId}.pdf`;
                    pdfPath = `documents/originals/${fallbackName}`;
                }

                await ingestionManager.ingestDocument(docId, pdfPath, {
                    base64Images: normalizeResult.base64Images,
                    metadata: {
                        normalized: true,
                        normalization_actions: actions
                    }
                });

                result.metadata.reingested = true;
                logger.info(`[NormalizationTool] Re-ingestion complete for doc ${docId}`);
            } catch (err) {
                result.metadata.warnings.push(`Re-ingestion failed: ${err.message}`);
                logger.warn(`[NormalizationTool] Re-ingestion failed: ${err.message}`);
            }
        }

        result.success = true;
        logger.info(`[NormalizationTool] Normalization complete for doc ${docId}`);

        return result;

    } catch (error) {
        logger.error(`[NormalizationTool] Failed for doc ${docId}: ${error.message}`);
        result.metadata.warnings.push(error.message);
        throw error;
    }
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
    normalizeImagesAI
};
