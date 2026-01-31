/**
 * VisualSignalAnalyzer.js
 *
 * specialized analyzer for first-pass visual signals:
 * - Document Type (Classification)
 * - Rotation (Normalization)
 * - Crop (Normalization)
 * - Text Overlays (Visual RAG)
 */

const logger = require('../logger');
const { promptRegistry, MODEL_NAMES } = require('../prompts/PromptRegistry');
const { createPipelineExecutor } = require('./ExpertPipelineExecutor');

class VisualSignalAnalyzer {
    constructor(ollamaService, options = {}) {
        this.ollamaService = ollamaService;
        this.options = {
            timeout: options.timeout || 30000,
            retries: options.retries || 2,
            ...options
        };
        // Reuse executor for LLM calls and parsing logic
        this.executor = createPipelineExecutor(ollamaService, options);
    }

    /**
     * Analyze document image for signals
     * @param {Object} document - Document object (must have image_data or base64Images)
     * @returns {Promise<Object>} Signal object
     */
    async analyze(document) {
        const image = document.image_data || (document.base64Images && document.base64Images[0]);

        if (!image) {
            logger.warn('[VisualSignalAnalyzer] No image data available for analysis');
            return null;
        }

        const promptId = 'VIS_SIGNAL_ANALYZER_V1';
        const messages = promptRegistry.buildMessages(
            promptId,
            {
                filename: document.filename || 'unknown',
                source_system: document.source || 'paperless-ngx'
            },
            image
        );

        const options = promptRegistry.getOptions(promptId);
        const timeout = this.options.timeout;

        try {
            logger.info({
                event: 'visual_signal_analysis_start',
                documentId: document.id || document.filename
            });

            const response = await this.executor._callOllamaWithTimeout(
                MODEL_NAMES.router,
                messages,
                options,
                timeout
            );

            const result = await this.executor._parseResponse(response, {
                id: 'visual_signal_analyzer',
                model: MODEL_NAMES.router
            });

            // Normalize result structure
            const signals = {
                classification: {
                    primary_domain: result.primary_domain || 'General',
                    document_type: result.document_type || 'unknown',
                    confidence: result.confidence || 0.5
                },
                normalization: {
                    rotate: {
                        needed: result.rotation?.needed || false,
                        degrees: result.rotation?.degrees || 0
                    },
                    crop: {
                        needed: result.crop?.needed || false,
                        box: result.crop?.box || null
                    }
                },
                overlays: Array.isArray(result.overlays) ? result.overlays : []
            };

            logger.info({
                event: 'visual_signal_analysis_complete',
                documentId: document.id || document.filename,
                signals: {
                    domain: signals.classification.primary_domain,
                    rotate: signals.normalization.rotate.degrees,
                    crop: signals.normalization.crop.needed
                }
            });

            return signals;

        } catch (error) {
            logger.warn({
                event: 'visual_signal_analysis_failed',
                documentId: document.id || document.filename,
                error: error.message
            });
            return null;
        }
    }
}

module.exports = { VisualSignalAnalyzer };
