/**
 * PreVisionNormalizer.js
 *
 * AI-driven document normalization service for pre-vision processing.
 * Handles geometry analysis, normalization actions, and re-ingestion of normalized documents.
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../../logger');
const config = require('../../../config/config');
const paperlessService = require('../../paperlessService');
const { pdfRenderer } = require('../../visual-rag/PDFRenderer');
const { guidanceClient } = require('../../guidance/GuidanceClient');
const { ingestionManager } = require('../../visual-rag/IngestionManager');
const { normalizeImagesAI } = require('./tools');

/**
 * Default options for normalization analysis
 * Merges hardcoded defaults with config-based overrides
 */
function getDefaultOptions() {
    return Object.freeze({
        analysisDpi: config.visualRag?.analysisRenderDpi || 300,
        targetDpi: config.visualRag?.visionRenderDpi || 300,
        maxPages: config.visualRag?.maxVisionPages || 4,
        // Guidance templates live in the guidance_service templates directory
        templatePath: config.normalization?.templatePath || path.join(
            process.cwd(),
            'guidance_service',
            'templates',
            'normalization_geometry.py'
        ),
        minConfidence: config.normalization?.minConfidence || 0.5,
        visionModel: config.ollama?.visionModel || 'qwen3-vl:8b',
        maxRetries: config.normalization?.maxRetries || 2,
        retryDelayMs: config.normalization?.retryDelayMs || 500,
        enableCaching: config.normalization?.enableCaching !== false,
        cacheDir: config.normalization?.cacheDir || path.join(
            process.cwd(),
            '.cache',
            'normalization'
        ),
        enableReingest: config.normalization?.enableReingest !== false
    });
}

class PreVisionNormalizer {
    constructor(options = {}) {
        this.paperlessService = options.paperlessService || paperlessService;
        this.pdfRenderer = options.pdfRenderer || pdfRenderer;
        this.guidanceClient = options.guidanceClient || guidanceClient;
        this.ingestionManager = options.ingestionManager || ingestionManager;

        // Get defaults from config and merge with provided options
        const defaultOptions = getDefaultOptions();
        this.options = this._normalizeOptions({ ...defaultOptions, ...options });

        // Cache commonly used options
        this.analysisDpi = this.options.analysisDpi;
        this.targetDpi = this.options.targetDpi;
        this.maxPages = this.options.maxPages;
        this.templatePath = this.options.templatePath;
        this.minConfidence = this.options.minConfidence;
        this.visionModel = this.options.visionModel;
        this.maxRetries = this.options.maxRetries;
        this.retryDelayMs = this.options.retryDelayMs;
        this.enableCaching = this.options.enableCaching;
        this.cacheDir = this.options.cacheDir;
        this.enableReingest = this.options.enableReingest;

        // Template cache
        this.templateCache = null;
        this.templateCacheTime = null;
        this.templateCacheTTL = 3600000; // 1 hour

        // Statistics
        this.stats = {
            totalAnalyses: 0,
            successfulNormalizations: 0,
            failedAnalyses: 0,
            reingestions: 0,
            fallbacksUsed: 0,
            cacheHits: 0,
            avgLatencyMs: 0,
            stageLatencies: {
                rendering: [],
                analyzing: [],
                normalizing: [],
                reingest: []
            }
        };

        logger.info({
            event: 'pre_vision_normalizer_initialized',
            options: {
                analysisDpi: this.analysisDpi,
                targetDpi: this.targetDpi,
                maxPages: this.maxPages,
                minConfidence: this.minConfidence,
                visionModel: this.visionModel,
                enableCaching: this.enableCaching,
                enableReingest: this.enableReingest
            }
        });
    }

    /**
     * Normalize and validate options
     * Ensures all options have correct types and value ranges
     * @param {Object} options - User-provided options
     * @returns {Object} Normalized options with defaults
     */
    _normalizeOptions(options = {}) {
        const normalized = {};

        if (Number.isFinite(options.analysisDpi) && options.analysisDpi > 0) {
            normalized.analysisDpi = options.analysisDpi;
        } else {
            normalized.analysisDpi = options.analysisDpi || 150;
        }

        if (Number.isFinite(options.targetDpi) && options.targetDpi > 0) {
            normalized.targetDpi = options.targetDpi;
        } else {
            normalized.targetDpi = options.targetDpi || 300;
        }

        if (Number.isFinite(options.maxPages) && options.maxPages > 0) {
            normalized.maxPages = Math.floor(options.maxPages);
        } else {
            normalized.maxPages = options.maxPages || 4;
        }

        if (Number.isFinite(options.minConfidence)) {
            normalized.minConfidence = Math.max(0, Math.min(1, options.minConfidence));
        } else {
            normalized.minConfidence = options.minConfidence || 0.5;
        }

        if (typeof options.templatePath === 'string' && options.templatePath.length > 0) {
            normalized.templatePath = options.templatePath;
        } else {
            normalized.templatePath = options.templatePath || path.join(
                process.cwd(),
                '.prompts',
                'templates',
                'normalization_guidance.md'
            );
        }

        if (typeof options.visionModel === 'string' && options.visionModel.length > 0) {
            normalized.visionModel = options.visionModel;
        } else {
            normalized.visionModel = options.visionModel || 'qwen3-vl:8b';
        }

        if (Number.isFinite(options.maxRetries) && options.maxRetries > 0) {
            normalized.maxRetries = Math.floor(options.maxRetries);
        } else {
            normalized.maxRetries = options.maxRetries || 2;
        }

        if (Number.isFinite(options.retryDelayMs) && options.retryDelayMs > 0) {
            normalized.retryDelayMs = Math.floor(options.retryDelayMs);
        } else {
            normalized.retryDelayMs = options.retryDelayMs || 500;
        }

        if (typeof options.enableCaching === 'boolean') {
            normalized.enableCaching = options.enableCaching;
        } else {
            normalized.enableCaching = options.enableCaching !== false;
        }

        if (typeof options.cacheDir === 'string' && options.cacheDir.length > 0) {
            normalized.cacheDir = options.cacheDir;
        } else {
            normalized.cacheDir = options.cacheDir || path.join(
                process.cwd(),
                '.cache',
                'normalization'
            );
        }

        if (typeof options.enableReingest === 'boolean') {
            normalized.enableReingest = options.enableReingest;
        } else {
            normalized.enableReingest = options.enableReingest !== false;
        }

        return Object.freeze(normalized);
    }

    /**
     * Get cached template or load from file
     * Implements in-memory caching with TTL for performance
     * @param {boolean} forceRefresh - Force reload from disk
     * @returns {Promise<string|null>} Template content or null
     */
    async _loadTemplate(forceRefresh = false) {
        try {
            // Check in-memory cache
            if (!forceRefresh && this.templateCache && this.templateCacheTime) {
                const age = Date.now() - this.templateCacheTime;
                if (age < this.templateCacheTTL) {
                    this.stats.cacheHits += 1;
                    logger.debug({
                        event: 'template_cache_hit',
                        ageMs: age,
                        ttlMs: this.templateCacheTTL
                    });
                    return this.templateCache;
                }
            }

            // Load from file
            if (!this.enableCaching) {
                logger.debug({
                    event: 'template_caching_disabled',
                    templatePath: this.templatePath
                });
            }

            const templateContent = await fs.readFile(this.templatePath, 'utf8');

            // Update cache
            this.templateCache = templateContent;
            this.templateCacheTime = Date.now();

            logger.debug({
                event: 'normalization_template_loaded',
                templatePath: this.templatePath,
                size: templateContent.length,
                cached: this.enableCaching
            });

            return templateContent;
        } catch (fileError) {
            logger.error({
                event: 'normalization_template_load_failed',
                templatePath: this.templatePath,
                error: fileError.message,
                code: fileError.code
            });
            return null;
        }
    }

    /**
     * Get copy of current statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset all statistics
     */
    resetStats() {
        this.stats = {
            totalAnalyses: 0,
            successfulNormalizations: 0,
            failedAnalyses: 0,
            reingestions: 0,
            fallbacksUsed: 0,
            cacheHits: 0,
            avgLatencyMs: 0,
            stageLatencies: {
                rendering: [],
                analyzing: [],
                normalizing: [],
                reingest: []
            }
        };
        logger.debug({
            event: 'normalizer_stats_reset'
        });
    }

    /**
     * Analyze and normalize document
     * Main entry point for document normalization workflow
     * @param {number} docId - Document ID
     * @param {Object} options - Analysis options (overrides instance options)
     * @returns {Promise<Object>} Normalization result
     */
    async analyzeAndNormalize(docId, options = {}) {
        this.stats.totalAnalyses += 1;

        const result = {
            success: false,
            document_id: docId,
            normalized_pages: [],
            metadata: {
                actions_applied: [],
                changes_detected: false,
                reingested: false,
                warnings: [],
                options_used: {},
                config_source: 'merged'
            }
        };

        const overallStart = Date.now();

        try {
            logger.info({
                event: 'normalization_start',
                documentId: docId,
                optionsProvided: Object.keys(options).length > 0
            });

            // Merge with instance options (provided options override instance defaults)
            const mergedOptions = this._normalizeOptions({ ...this.options, ...options });
            result.metadata.options_used = {
                analysisDpi: mergedOptions.analysisDpi,
                targetDpi: mergedOptions.targetDpi,
                maxPages: mergedOptions.maxPages,
                minConfidence: mergedOptions.minConfidence,
                enableReingest: mergedOptions.enableReingest,
                visionModel: mergedOptions.visionModel,
                source: 'config_merged_with_overrides'
            };

            // Download original document
            const pdfBuffer = await this.paperlessService.downloadOriginalDocument(docId)
                || await this.paperlessService.downloadDocument(docId);

            if (!pdfBuffer) {
                throw new Error(`Unable to download document ${docId}`);
            }

            // Render first page at analysis DPI
            const renderStart = Date.now();
            const rendered = await this.pdfRenderer.renderBuffer(pdfBuffer, {
                dpi: mergedOptions.analysisDpi,
                maxPages: 1,
                docId
            });
            const renderLatency = Date.now() - renderStart;
            this.stats.stageLatencies.rendering.push(renderLatency);

            if (!rendered || rendered.length === 0) {
                throw new Error('Failed to render document for analysis');
            }

            const analysisImage = rendered[0].base64;
            const pageGeometry = {
                width: rendered[0].width || 2480,
                height: rendered[0].height || 3508
            };

            // Load normalization template
            const promptTemplate = await this._loadTemplate();
            if (!promptTemplate) {
                result.metadata.warnings.push('Template not found, skipping normalization');
                result.success = true;
                logger.info({
                    event: 'normalization_skipped_no_template',
                    documentId: docId
                });
                return result;
            }

            // Analyze document geometry
            const analyzeStart = Date.now();
            const geometryAnalysisResult = await this._analyzeGeometry(
                analysisImage,
                promptTemplate,
                mergedOptions.maxRetries
            );
            const analyzeLatency = Date.now() - analyzeStart;
            this.stats.stageLatencies.analyzing.push(analyzeLatency);

            // Parse geometry analysis response
            const geometry = this._parseGeometryAnalysis(geometryAnalysisResult);

            if (!geometry) {
                result.metadata.warnings.push('Failed to parse geometry analysis');
                result.success = true;
                logger.info({
                    event: 'normalization_parse_failed',
                    documentId: docId
                });
                return result;
            }

            // Check confidence threshold
            if (geometry.confidence < mergedOptions.minConfidence) {
                result.metadata.warnings.push(
                    `Low confidence analysis (${geometry.confidence}), skipping normalization`
                );
                result.success = true;
                result.metadata.geometry_confidence = geometry.confidence;
                logger.info({
                    event: 'normalization_low_confidence',
                    documentId: docId,
                    confidence: geometry.confidence,
                    threshold: mergedOptions.minConfidence
                });
                return result;
            }

            // Build normalization actions from geometry
            const actions = this._buildNormalizationActions(geometry, pageGeometry);
            if (actions.length === 0) {
                logger.info({
                    event: 'normalization_not_needed',
                    documentId: docId,
                    geometry: {
                        rotate: geometry.rotate,
                        needsCrop: geometry.needs_crop,
                        confidence: geometry.confidence
                    }
                });
                result.success = true;
                result.metadata.reasoning = geometry.reasoning;
                result.metadata.geometry_confidence = geometry.confidence;
                return result;
            }

            result.metadata.actions_applied = actions.map(a => this._extractActionParams(a));
            result.metadata.changes_detected = true;
            result.metadata.geometry_used = {
                rotate: geometry.rotate,
                needsCrop: geometry.needs_crop,
                cropBox: geometry.crop_box,
                targetDpi: geometry.target_dpi,
                confidence: geometry.confidence
            };

                // Apply normalization via paperless tool
                const applyStart = Date.now();
                await new Promise(resolve => setImmediate(resolve));

                // Lazy-load the normalization tools factory to avoid circular requires
                const { createNormalizationTools } = require('./tools');
                const tools = createNormalizationTools({ preVisionNormalizer: this });
                const normalizeResult = await tools.normalizeImagesAI({
                    document_id: docId,
                    actions,
                    target_dpi: geometry.target_dpi || mergedOptions.targetDpi,
                    max_pages: mergedOptions.maxPages,
                    format: 'png'
                });
            const applyLatency = Date.now() - applyStart;
            this.stats.stageLatencies.normalizing.push(applyLatency);

            if (!normalizeResult || !normalizeResult.base64Images) {
                throw new Error('Normalization tool failed');
            }

            result.normalized_pages = normalizeResult.base64Images.map((base64, idx) => ({
                page: idx + 1,
                base64,
                width: normalizeResult.metadata?.pages?.[idx]?.width || null,
                height: normalizeResult.metadata?.pages?.[idx]?.height || null
            }));

            // Determine if re-ingestion is needed
            const shouldReingest = mergedOptions.enableReingest &&
                this._shouldReingest(geometry, actions);

            if (shouldReingest) {
                const reingestStart = Date.now();
                try {
                    const doc = await this.paperlessService.getDocument(docId);

                    const archiveName = doc?.archive_file_name || doc?.archive_filename;
                    const originalName = doc?.original_file_name || doc?.originalFileName || null;
                    let pdfPath;

                    if (archiveName) {
                        pdfPath = `documents/archive/${archiveName}`;
                    } else {
                        const fallbackName = originalName || `doc-${docId}.pdf`;
                        pdfPath = `documents/originals/${fallbackName}`;
                    }

                    await this.ingestionManager.ingestDocument(docId, pdfPath, {
                        base64Images: normalizeResult.base64Images,
                        metadata: {
                            normalized: true,
                            normalization_actions: actions,
                            geometry_analysis: {
                                rotate: geometry.rotate,
                                needsCrop: geometry.needs_crop,
                                confidence: geometry.confidence
                            },
                            config_used: {
                                analysisDpi: mergedOptions.analysisDpi,
                                targetDpi: mergedOptions.targetDpi
                            }
                        }
                    });

                    result.metadata.reingested = true;
                    this.stats.reingestions += 1;

                    logger.info({
                        event: 'normalization_reingestion_complete',
                        documentId: docId,
                        imageCount: normalizeResult.base64Images.length
                    });
                } catch (reingestError) {
                    result.metadata.warnings.push(`Re-ingestion failed: ${reingestError.message}`);
                    logger.warn({
                        event: 'normalization_reingestion_failed',
                        documentId: docId,
                        error: reingestError.message
                    });
                } finally {
                    const reingestLatency = Date.now() - reingestStart;
                    this.stats.stageLatencies.reingest.push(reingestLatency);
                }
            }

            result.success = true;
            this.stats.successfulNormalizations += 1;

            const totalLatency = Date.now() - overallStart;
            const n = this.stats.totalAnalyses;
            this.stats.avgLatencyMs = ((this.stats.avgLatencyMs * (n - 1)) + totalLatency) / n;

            logger.info({
                event: 'normalization_complete',
                documentId: docId,
                totalLatencyMs: totalLatency,
                actionsApplied: actions.length,
                reingested: result.metadata.reingested,
                configSource: 'merged'
            });

            return result;
        } catch (analysisError) {
            this.stats.failedAnalyses += 1;
            logger.error({
                event: 'normalization_failed',
                documentId: docId,
                error: analysisError.message
            });
            result.metadata.warnings.push(analysisError.message);
            throw analysisError;
        }
    }

    /**
     * Analyze document geometry using vision model
     * Attempts Guidance service first, falls back to Ollama
     * @param {string} base64Image - Base64-encoded image
     * @param {string} promptTemplate - Prompt template for analysis
     * @param {number} maxRetries - Maximum retry attempts
     * @returns {Promise<Object>} Geometry analysis result with source and fallback handling
     */
    async _analyzeGeometry(base64Image, promptTemplate, maxRetries = 2) {
        const fallbackResult = {
            geometry: null,
            source: null,
            error: null,
            attempt: 0
        };

        for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
            fallbackResult.attempt = attempt;
            try {
                // Attempt Guidance generation
                // Pass the base64 image using the variable name expected by
                // the Guidance template: `document_image_b64`.
                const result = await this.guidanceClient.generate('normalization_geometry', {
                    document_image_b64: base64Image
                }, {
                    model: this.visionModel,
                    temperature: 0.2
                });

                // Robust extraction of geometry from various response structures
                let extracted = null;
                if (result.geometry) {
                    extracted = result.geometry;
                } else if (result.generated && result.generated.geometry) {
                    extracted = result.generated.geometry;
                } else if (result.generated && typeof result.generated === 'object') {
                    extracted = result.generated;
                }

                if (!extracted || typeof extracted !== 'object') {
                    throw new Error('Invalid geometry response structure');
                }

                // Validate geometry structure
                const validatedGeometry = this._validateGeometry(extracted);
                if (!validatedGeometry) {
                    throw new Error('Geometry validation failed');
                }

                fallbackResult.geometry = validatedGeometry;
                fallbackResult.source = 'guidance';

                logger.info({
                    event: 'geometry_analysis_success',
                    source: 'guidance',
                    attempt,
                    confidence: validatedGeometry.confidence,
                    rotate: validatedGeometry.rotate,
                    needsCrop: validatedGeometry.needs_crop
                });

                return fallbackResult;
            } catch (guidanceError) {
                logger.warn({
                    event: 'geometry_analysis_guidance_failed',
                    attempt,
                    error: guidanceError.message
                });

                fallbackResult.error = guidanceError;

                // On first failure, attempt Ollama fallback
                if (attempt === 1) {
                    try {
                        const geometry = await this._fallbackVisionAnalysis(base64Image, promptTemplate);
                        if (geometry) {
                            const validatedGeometry = this._validateGeometry(geometry);
                            if (validatedGeometry) {
                                fallbackResult.geometry = validatedGeometry;
                                fallbackResult.source = 'ollama_fallback';
                                this.stats.fallbacksUsed += 1;

                                logger.info({
                                    event: 'geometry_analysis_ollama_fallback_success',
                                    confidence: validatedGeometry.confidence
                                });

                                return fallbackResult;
                            }
                        }
                    } catch (ollamaError) {
                        logger.error({
                            event: 'geometry_analysis_ollama_fallback_failed',
                            error: ollamaError.message
                        });
                        fallbackResult.error = ollamaError;
                    }
                }

                // If not last attempt, retry after delay
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, this.retryDelayMs * attempt));
                    continue;
                }
            }
        }

        logger.error({
            event: 'geometry_analysis_all_attempts_failed',
            attempts: maxRetries,
            visionModel: this.visionModel
        });

        fallbackResult.geometry = {
            rotate: 0,
            needs_crop: false,
            crop_box: null,
            target_dpi: this.targetDpi,
            confidence: 0.0,
            reasoning: 'Default: analysis failed, no transformations applied'
        };
        fallbackResult.source = 'default_safe';

        return fallbackResult;
    }

    /**
     * Validate geometry object structure and values
     * Ensures all required fields are present and valid
     * @param {Object} geometry - Geometry object to validate
     * @returns {Object|null} Validated geometry or null if invalid
     */
    _validateGeometry(geometry) {
        if (!geometry || typeof geometry !== 'object') {
            logger.warn({
                event: 'geometry_validation_not_object',
                type: typeof geometry
            });
            return null;
        }

        // Validate rotation
        const rotate = Number.isFinite(geometry.rotate) ? geometry.rotate : 0;
        if (![0, 90, 180, 270].includes(rotate)) {
            logger.warn({
                event: 'geometry_invalid_rotation',
                provided: geometry.rotate,
                normalized: 0
            });
            return null;
        }

        // Validate crop flag
        const needsCrop = typeof geometry.needs_crop === 'boolean' ? geometry.needs_crop : false;

        // Validate confidence
        const confidence = Number.isFinite(geometry.confidence)
            ? Math.max(0, Math.min(1, geometry.confidence))
            : 0.5;

        // Validate crop box if crop is needed
        let cropBox = null;
        if (needsCrop && Array.isArray(geometry.crop_box) && geometry.crop_box.length === 4) {
            cropBox = geometry.crop_box;
        }

        // Validate target DPI
        const targetDpi = Number.isFinite(geometry.target_dpi) && geometry.target_dpi > 0
            ? geometry.target_dpi
            : this.targetDpi;

        return {
            rotate,
            needs_crop: needsCrop,
            crop_box: cropBox,
            target_dpi: targetDpi,
            confidence,
            reasoning: typeof geometry.reasoning === 'string' ? geometry.reasoning : 'Analysis complete'
        };
    }

    /**
     * Parse geometry analysis response (string or object)
     * Handles various response formats from vision models
     * @param {Object} response - Response from geometry analysis
     * @returns {Object|null} Parsed geometry or null if invalid
     */
    _parseGeometryAnalysis(response) {
        try {
            if (!response || !response.geometry) {
                logger.warn({
                    event: 'geometry_analysis_empty_response',
                    source: response?.source
                });
                return null;
            }

            let geometry = response.geometry;

            if (typeof geometry === 'string') {
                let cleaned = geometry.trim();
                if (cleaned.startsWith('```')) {
                    cleaned = cleaned.split('\n').slice(1).join('\n');
                    cleaned = cleaned.substring(0, cleaned.lastIndexOf('```'));
                }
                geometry = JSON.parse(cleaned);
            }

            if (typeof geometry !== 'object') {
                logger.error({
                    event: 'geometry_parse_invalid_type',
                    type: typeof geometry
                });
                return null;
            }

            return geometry;
        } catch (parseError) {
            logger.error({
                event: 'geometry_parse_error',
                error: parseError.message
            });
            return null;
        }
    }

    /**
     * Denormalize crop box coordinates from normalized [0-1000] to pixel coordinates
     * @param {Array<number>} box - Normalized box [xmin, ymin, xmax, ymax]
     * @param {number} width - Page width in pixels
     * @param {number} height - Page height in pixels
     * @returns {Object|null} Pixel coordinates or null if invalid
     */
    _denormalizeCoordinates(box, width, height) {
        if (!box || !Array.isArray(box) || box.length !== 4) {
            return null;
        }

        const [xmin, ymin, xmax, ymax] = box.map(c => Math.max(0, Math.min(1000, c)));

        const pixelBox = {
            x: Math.round((xmin / 1000) * width),
            y: Math.round((ymin / 1000) * height),
            width: Math.round(((xmax - xmin) / 1000) * width),
            height: Math.round(((ymax - ymin) / 1000) * height),
            unit: 'pixel'
        };

        // Validate resulting box has reasonable size
        if (pixelBox.width < 10 || pixelBox.height < 10) {
            logger.warn({
                event: 'geometry_denormalized_box_too_small',
                box: pixelBox
            });
            return null;
        }

        return pixelBox;
    }

    /**
     * Build normalization actions from geometry analysis
     * Creates appropriate transformations based on geometry findings
     * @param {Object} geometry - Geometry analysis result
     * @param {Object} pageGeometry - Page dimensions {width, height}
     * @returns {Array<Object>} Normalization actions
     */
    _buildNormalizationActions(geometry, pageGeometry) {
        const actions = [];

        // Add rotation action if needed
        if (geometry.rotate && geometry.rotate !== 0) {
            actions.push({
                type: 'rotate',
                degrees: geometry.rotate
            });
        }

        // Add crop action if needed
        if (geometry.needs_crop && geometry.crop_box) {
            const cropBox = this._denormalizeCoordinates(
                geometry.crop_box,
                pageGeometry.width || 2480,
                pageGeometry.height || 3508
            );

            if (cropBox && cropBox.width > 50 && cropBox.height > 50) {
                actions.push({
                    type: 'crop',
                    box: cropBox
                });
            }
        }

        // Add DPI action if target differs from current
        if (geometry.target_dpi && geometry.target_dpi > 0) {
            actions.push({
                type: 'dpi',
                target: geometry.target_dpi
            });
        }

        return actions;
    }

    /**
     * Determine if re-ingestion is needed based on geometry and actions
     * Re-ingestion allows visual RAG to index normalized images
     * @param {Object} geometry - Geometry analysis
     * @param {Array<Object>} actions - Normalization actions
     * @returns {boolean} Whether re-ingestion should occur
     */
    _shouldReingest(geometry, actions) {
        // Re-ingest if rotation was applied
        if (actions.some(a => a.type === 'rotate' && a.degrees !== 0)) {
            logger.debug({
                event: 'reingest_reason_rotation',
                degrees: actions.find(a => a.type === 'rotate')?.degrees
            });
            return true;
        }

        // Re-ingest if crop was applied
        const cropAction = actions.find(a => a.type === 'crop');
        if (cropAction) {
            logger.debug({
                event: 'reingest_reason_crop',
                box: cropAction.box
            });
            return true;
        }

        // Re-ingest if DPI change is significant
        if (actions.some(a => a.type === 'dpi')) {
            const targetDpi = actions.find(a => a.type === 'dpi')?.target;
            logger.debug({
                event: 'reingest_reason_dpi_change',
                targetDpi
            });
            return true;
        }

        logger.debug({
            event: 'reingest_not_needed',
            actionsCount: actions.length
        });
        return false;
    }

    /**
     * Fallback vision analysis using Ollama
     * Called when Guidance service fails
     * @param {string} base64Image - Base64-encoded image
     * @param {string} prompt - Analysis prompt
     * @returns {Promise<Object|null>} Geometry object or null if failed
     */
    async _fallbackVisionAnalysis(base64Image, prompt) {
        try {
            if (!base64Image || typeof base64Image !== 'string') {
                logger.warn({
                    event: 'fallback_vision_invalid_image',
                    imageType: typeof base64Image
                });
                return null;
            }

            const ollamaService = require('../../ollamaService');
            const { extractJsonFromResponse } = require('../../ollama/utils');

            if (!ollamaService || typeof ollamaService._callOllamaVisionAPI !== 'function') {
                logger.warn({
                    event: 'fallback_vision_service_unavailable'
                });
                return null;
            }

            const response = await ollamaService._callOllamaVisionAPI(prompt, base64Image);
            const responseText = response?.response || response?.message?.content || '';

            if (!responseText) {
                logger.warn({
                    event: 'fallback_vision_empty_response'
                });
                return null;
            }

            const json = extractJsonFromResponse(responseText.toString());
            if (!json) {
                logger.warn({
                    event: 'fallback_vision_invalid_json'
                });
                return null;
            }

            logger.info({
                event: 'fallback_vision_success',
                hasGeometry: !!json.geometry
            });

            return json;
        } catch (fallbackError) {
            logger.warn({
                event: 'fallback_vision_analysis_error',
                error: fallbackError.message
            });
            return null;
        }
    }

    /**
     * Extract action parameters for result metadata
     * Filters out undefined and null values
     * @param {Object} action - Normalization action
     * @returns {Object} Action with only defined parameters
     */
    _extractActionParams(action) {
        const params = {
            type: action.type
        };

        if (action.degrees !== undefined && action.degrees !== null) {
            params.degrees = action.degrees;
        }

        if (action.box) {
            params.box = action.box;
        }

        if (action.target !== undefined && action.target !== null) {
            params.target = action.target;
        }

        if (action.scale !== undefined && action.scale !== null) {
            params.scale = action.scale;
        }

        if (action.width !== undefined && action.width !== null) {
            params.width = action.width;
        }

        if (action.height !== undefined && action.height !== null) {
            params.height = action.height;
        }

        return params;
    }

    /**
     * Clear template cache (useful for testing)
     */
    clearTemplateCache() {
        this.templateCache = null;
        this.templateCacheTime = null;
        logger.debug({
            event: 'template_cache_cleared'
        });
    }

    /**
     * Update configuration options at runtime
     * @param {Object} options - New options to merge
     */
    updateOptions(options = {}) {
        this.options = this._normalizeOptions({
            ...this.options,
            ...options
        });

        // Update cached properties
        this.analysisDpi = this.options.analysisDpi;
        this.targetDpi = this.options.targetDpi;
        this.maxPages = this.options.maxPages;
        this.minConfidence = this.options.minConfidence;
        this.visionModel = this.options.visionModel;
        this.maxRetries = this.options.maxRetries;
        this.retryDelayMs = this.options.retryDelayMs;
        this.enableCaching = this.options.enableCaching;
        this.cacheDir = this.options.cacheDir;
        this.enableReingest = this.options.enableReingest;

        logger.info({
            event: 'normalizer_options_updated',
            updatedFields: Object.keys(options),
            newOptions: {
                analysisDpi: this.analysisDpi,
                targetDpi: this.targetDpi,
                visionModel: this.visionModel
            }
        });
    }
}

const preVisionNormalizer = new PreVisionNormalizer();

module.exports = {
    PreVisionNormalizer,
    preVisionNormalizer
};