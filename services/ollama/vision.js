const fs = require('fs').promises;
const path = require('path');
const config = require('../../config/config');
const paperlessService = require('../paperlessService');
const { pdfRenderer } = require('../visual-rag/PDFRenderer');
const TelemetryCollector = require('../TelemetryCollector');
const { calculateTokens, extractJsonFromResponse } = require('./utils');
const truncationMetrics = require('./truncationMetrics');
const logger = require('../logger');

module.exports = function createVisionModule(dependencies = {}) {
    const { ExpertPipelineExecutor, expertRegistry } = dependencies;
    return {
    _looksLikePdf(buffer) {
        if (!buffer || buffer.length < 5) return false;
        return buffer.slice(0, 5).toString('utf8') === '%PDF-';
    },

    _looksLikeImage(buffer) {
        if (!buffer || buffer.length < 4) return false;
        const b0 = buffer[0];
        const b1 = buffer[1];
        const b2 = buffer[2];
        const b3 = buffer[3];
        const isPng = b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47;
        const isJpeg = b0 === 0xff && b1 === 0xd8;
        const isTiff = (b0 === 0x49 && b1 === 0x49 && b2 === 0x2a && b3 === 0x00)
            || (b0 === 0x4d && b1 === 0x4d && b2 === 0x00 && b3 === 0x2a);
        return isPng || isJpeg || isTiff;
    },
    /**
     * Analyze document using vision model
     * @param {number|string} documentId - Document ID
     * @param {string} content - Document text content (for classification)
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeDocumentWithVision(documentId, content, options = {}) {
        const startTime = Date.now();
        const telemetry = new TelemetryCollector(documentId);
        let fallbackTriggered = false;
        let fallbackReason = null;
        try {
            logger.info(`[VISION] Starting vision analysis for document ${documentId}`);

            let plannerResult;
            let preNormalizedImages = null;

            // Optional pre-normalization (if enabled via options)
            if (options.preNormalize && config.expertPipelineEnabled === 'yes') {
                logger.info(`[VISION] Pre-normalization requested for doc ${documentId}`);
                try {
                    const { preVisionNormalizer } = require('../experts/normalization/PreVisionNormalizer');
                    const normResult = await preVisionNormalizer.analyzeAndNormalize(documentId);
                    
                    if (normResult && normResult.success) {
                        // Prefer normalized_pages but accept base64Images as fallback
                        if (Array.isArray(normResult.normalized_pages) && normResult.normalized_pages.length > 0) {
                            preNormalizedImages = normResult.normalized_pages;
                        } else if (Array.isArray(normResult.base64Images) && normResult.base64Images.length > 0) {
                            preNormalizedImages = normResult.base64Images;
                        }

                        if (preNormalizedImages && preNormalizedImages.length > 0) {
                            logger.info(`[VISION] Pre-normalization applied: ${normResult.metadata.actions_applied?.length || 0} actions; using ${preNormalizedImages.length} normalized pages`);
                            // Clear vision cache to force re-render with normalized document
                            await this._clearVisionCache(documentId);
                            await this._delay(1500); // Allow Paperless to process rotation if applied
                        } else {
                            logger.info('[VISION] Pre-normalization completed with no normalized pages returned');
                        }
                    }
                } catch (error) {
                    logger.warn(`[VISION] Pre-normalization failed: ${error.message}`);
                    // Continue with original document
                }
            }

            const plannerStage = telemetry.startStage('planner', config.ollama.plannerModel || config.ollama.visionModel);
            try {
                plannerResult = await this.analyzeDocumentPlannerVision(documentId);
                telemetry.endStage(plannerStage, true);
            } catch (error) {
                telemetry.endStage(plannerStage, false);
                logger.warn('[VISION] Planner failed, using default profile');
                void error;
                plannerResult = {
                    category: 'general',
                    doc_type_hint: null,
                    modality: 'unknown',
                    confidence: 0.5,
                    keywords: [],
                    needs_visual: true,
                    rotation_degrees: 0
                };
                plannerResult.routing = this._buildRoutingMetadata(plannerResult);
            }

            logger.info('[VISION] Final classification: ' + JSON.stringify(plannerResult));

            const rotationDegrees = this._normalizeRotationDegrees(plannerResult?.rotation_degrees);
            let rotationApplied = false;
            if (rotationDegrees && rotationDegrees !== 0) {
                logger.info(`[PLANNER] Rotation detected (${rotationDegrees} degrees) for document ${documentId}`);
                const rotated = await paperlessService.rotateDocuments(documentId, rotationDegrees);
                if (rotated) {
                    rotationApplied = true;
                    await this._clearVisionCache(documentId);
                    await this._delay(1500);
                    const refreshedPlanner = await this.analyzeDocumentPlannerVision(documentId);
                    if (refreshedPlanner) {
                        plannerResult = { ...refreshedPlanner, rotation_degrees: 0 };
                        logger.info('[PLANNER] Classification refreshed after rotation');
                    }
                } else {
                    logger.warn(`[PLANNER] Rotation request failed for document ${documentId}`);
                }
            }

            // Record rotation application in telemetry and logs
            if (rotationApplied) {
                logger.info(`[PLANNER] Rotation applied for document ${documentId}`);
            }
            try {
                if (telemetry && telemetry.telemetry) telemetry.telemetry.rotationApplied = rotationApplied;
            } catch (e) { void e; }

            const plannerRenderDpi = config.visualRag?.visionRenderDpi || 300;
            let base64Image = await this._loadPlannerImageAsBase64(documentId, plannerRenderDpi);
            if (!base64Image) {
                logger.info('[VISION] Fallback to text: no render or thumbnail available');
                const fallbackStage = telemetry.startStage('fallback', this.model);
                const textResult = await this._analyzeDocumentText(
                    content,
                    options.existingTags || [],
                    options.existingCorrespondentList || [],
                    options.existingDocumentTypesList || [],
                    documentId,
                    null,
                    options
                );
                telemetry.endStage(fallbackStage, true);
                fallbackTriggered = true;
                fallbackReason = 'no_thumbnail';
                telemetry.setRouting(
                    {
                        category: plannerResult.category,
                        confidence: plannerResult.confidence,
                        modality: plannerResult.modality,
                        expertPipeline: plannerResult.routing?.expertPipeline
                    },
                    fallbackTriggered,
                    fallbackReason
                );
                const telemetryPayload = telemetry.finalize();
                logger.info('[TELEMETRY] ' + JSON.stringify(telemetryPayload));
                return { ...textResult, _planner: plannerResult, _telemetry: telemetryPayload };
            }

            // Initialize FieldProfiler
            await this.fieldProfiler.init();

            // Select profile based on classification
            const profileId = this.fieldProfiler.selectProfile(plannerResult);
            logger.info(`[VISION] Using profile: ${profileId}`);
            logger.info(`[PLANNER] Selected profile: ${profileId} (confidence: ${plannerResult.confidence})`);
            const fieldSet = this.fieldProfiler.getFieldSet(profileId);

            const renderDpi = config.visualRag?.visionRenderDpi || 300;
            const maxVisionPages = config.visualRag.maxVisionPages;
            let pagesToRender = [1];

            if (plannerResult.category === 'financial') {
                try {
                    const doc = await paperlessService.getDocument(documentId);
                    const pageCount = doc?.page_count || doc?.pageCount;
                    if (pageCount && Number.isInteger(pageCount) && pageCount > 1) {
                        pagesToRender.push(pageCount);
                    }
                } catch (error) {
                    logger.warn(`[VISION] Failed to fetch page count for ${documentId}: ${error.message}`);
                }
            }

            pagesToRender = [...new Set(pagesToRender)].slice(0, maxVisionPages);
            logger.info(`[VISION] Rendering pages: ${pagesToRender.join(', ')} at ${renderDpi} DPI`);

            const renderedImages = [];

            // Prefer pre-normalized images when available (from pre-normalizer run)
            if (Array.isArray(preNormalizedImages) && preNormalizedImages.length > 0) {
                logger.info(`[VISION] Using ${preNormalizedImages.length} pre-normalized images provided by PreVisionNormalizer`);
                renderedImages.push(...preNormalizedImages.slice(0, pagesToRender.length));
            } else {
                // Fallback: attempt to resolve images from document object (may contain previously stored normalized images)
                const { resolveDocumentImages } = require('../experts/utils/normalizers');
                let docObj = null;
                try {
                    docObj = await paperlessService.getDocument(documentId);
                } catch (err) {
                    // ignore and fall back to rendering
                    void err;
                }

                const imageResolution = resolveDocumentImages(docObj || {});
                if (imageResolution.source === 'normalized' && Array.isArray(imageResolution.base64Images) && imageResolution.base64Images.length > 0) {
                    logger.info(`[VISION] Using ${imageResolution.base64Images.length} pre-normalized images found on document object`);
                    renderedImages.push(...imageResolution.base64Images.slice(0, pagesToRender.length));
                } else {
                    for (const page of pagesToRender) {
                        const rendered = await this._loadRenderedPageAsBase64(documentId, page, renderDpi);
                        if (rendered) {
                            renderedImages.push(rendered);
                        }
                    }
                }
            }

            const extractionImages = renderedImages.length > 0 ? renderedImages : [base64Image];

            const maxRetries = Math.max(config.visualRag.maxRetriesExtractor, 2);
            let parsedResponse = null;
            let validation = { valid: false, errors: [] };
            const visionStage = telemetry.startStage('vision', config.ollama.visionModel);
            const visionLimits = this._resolveOllamaLimits('vision', config.ollama.visionModel);
            logger.info({
                event: 'prompt_template_selected',
                stage: 'vision_extraction',
                model: config.ollama.visionModel,
                profileId,
                strict: false,
                renderDpi,
                pagesRendered: renderedImages.length,
                responseTokens: visionLimits.maxResponseTokens,
                contextWindow: visionLimits.contextWindow,
                limitsSource: visionLimits.source,
                modelKey: visionLimits.modelKey
            });

            for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
                const prompt = this.promptFactory.buildVisionPrompt(fieldSet, fieldSet.profileName, { strict: attempt > 0 });
                if (attempt > 0) {
                    logger.warn(`[VISION] Extraction retry ${attempt}/${maxRetries}`);
                }

                const response = await this._callOllamaVisionAPI(prompt, extractionImages);
                const rawText = this._extractRawOllamaText(response);
                try {
                    parsedResponse = this._processOllamaResponse(response);
                } catch (error) {
                    logger.warn(`[VISION] Failed to parse response: ${error.message}`);
                    if (attempt < maxRetries) {
                        continue;
                    }
                    if (rawText) {
                        try {
                            logger.warn('[VISION] Attempting repair with text model');
                            parsedResponse = await this._repairJsonWithTextModel(rawText);
                        } catch (repairError) {
                            logger.error(`[VISION] Repair failed: ${repairError.message}`);
                            parsedResponse = this._buildUserReviewFallback();
                            validation = this.fieldProfiler.validateResult(parsedResponse, profileId);
                            break;
                        }
                    } else {
                        parsedResponse = this._buildUserReviewFallback();
                        validation = this.fieldProfiler.validateResult(parsedResponse, profileId);
                        break;
                    }
                }

                parsedResponse = this._applyNoteDefaults(parsedResponse);
                parsedResponse = this._applyLegacyVisionFallbacks(parsedResponse, options);
                validation = this.fieldProfiler.validateResult(parsedResponse, profileId);
                validation = this._relaxVisionValidation(validation);

                if (validation.valid) {
                    break;
                }

                logger.warn(`[VISION] Extraction validation failed: ${validation.errors.join(', ')}`);
            }

            telemetry.endStage(visionStage, validation.valid);
            if (!validation.valid) {
                logger.warn('[VISION] Extraction invalid after retries, falling back to text-only');
                const fallbackStage = telemetry.startStage('fallback', this.model);
                const textResult = await this._analyzeDocumentText(
                    content,
                    options.existingTags || [],
                    options.existingCorrespondentList || [],
                    options.existingDocumentTypesList || [],
                    documentId,
                    null,
                    options
                );
                telemetry.endStage(fallbackStage, true);
                fallbackTriggered = true;
                fallbackReason = 'vision_validation_failed';
                telemetry.setRouting(
                    {
                        category: plannerResult.category,
                        confidence: plannerResult.confidence,
                        modality: plannerResult.modality,
                        expertPipeline: plannerResult.routing?.expertPipeline
                    },
                    fallbackTriggered,
                    fallbackReason
                );
                const telemetryPayload = telemetry.finalize();
                logger.info('[TELEMETRY] ' + JSON.stringify(telemetryPayload));
                return { ...textResult, _planner: plannerResult, _telemetry: telemetryPayload };
            }

            const visionElapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            const visionResult = {
                document: parsedResponse,
                metrics: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    processingTime: visionElapsedTime
                },
                truncated: false,
                _analysisMode: 'VISION_ONLY',
                _planner: plannerResult
            };

            const extractionSchema = this.fieldProfiler.generateExtractionSchema(profileId);
            const requiredFields = Array.isArray(options.requiredFields)
                ? options.requiredFields
                : (extractionSchema?.required || []);
            const minConfidence = typeof options.minConfidence === 'number'
                ? options.minConfidence
                : 0.7;
            const extractionValidation = this.extractionValidator.validateExtraction(
                parsedResponse,
                requiredFields,
                minConfidence
            );
            const fallbackEnabled = options.fallbackEnabled !== false;
            const fieldsRequested = requiredFields.length;
            const fieldsExtracted = requiredFields.filter(field => parsedResponse?.[field] !== null && parsedResponse?.[field] !== undefined).length;
            telemetry.setExtractionStats(
                fieldsRequested,
                fieldsExtracted,
                extractionValidation.missingFields,
                extractionValidation.lowConfidenceFields
            );
            telemetry.setValidation(extractionValidation.score, extractionValidation.isValid);

            if (config.expertPipelineEnabled === 'yes') {
                // Build a structured classification object expected by ExpertRegistry.route
                const classificationResult = {
                    classification: {
                        primary_domain: plannerResult?.category || 'general',
                        document_type: plannerResult?.doc_type_hint || null,
                        confidence: typeof plannerResult?.confidence === 'number' ? plannerResult.confidence : 0,
                        metadata_hints: {
                            modality: plannerResult?.modality || 'unknown'
                        }
                    }
                };

                const { pipeline, routingMetadata } = expertRegistry.route(classificationResult);
                if (routingMetadata) {
                    logger.debug(`[VISION] Routing metadata: ${JSON.stringify(routingMetadata)}`);
                    try { if (telemetry && telemetry.telemetry) telemetry.telemetry.routingMetadata = routingMetadata; } catch (e) { void e; }
                }
                if (pipeline && plannerResult.routing?.expertPipeline) {
                    logger.info(`[VISION] Triggering expert pipeline: ${pipeline.domain} (${pipeline.id})`);

                    const expertContext = {
                        documentId,
                        modality: plannerResult.modality || 'unknown',
                        doc_type_hint: plannerResult.doc_type_hint,
                        base64Image: extractionImages[0],
                        content,
                        visionResult: parsedResponse,
                        missingFields: extractionValidation.missingFields
                    };

                    // Pass the Ollama service instance (this) and configuration options
                    const expertExecutor = new ExpertPipelineExecutor(this, { defaultTimeout: config.expertPipelineTimeout || 60000 });
                    const expertResult = await expertExecutor.execute(
                        pipeline.id,
                        expertContext,
                        plannerResult,
                        { telemetry }
                    );

                    if (expertResult) {
                        parsedResponse = this._mergeAnalysisResults(
                            { document: parsedResponse },
                            { document: expertResult }
                        ).document;
                        logger.info(`[VISION] Expert pipeline merged ${Object.keys(expertResult).length} fields`);
                    }
                }
            }

            this._persistHealthMetrics(documentId, parsedResponse, plannerResult);

            if (extractionValidation.shouldFallback && fallbackEnabled) {
                logger.info(`[FALLBACK] Triggering fallback for doc ${documentId}`);
                const fallbackStage = telemetry.startStage('fallback', this.model);
                const fallbackResult = await this._analyzeDocumentText(
                    content,
                    options.existingTags || [],
                    options.existingCorrespondentList || [],
                    options.existingDocumentTypesList || [],
                    documentId,
                    null,
                    options
                );
                telemetry.endStage(fallbackStage, true);

                const mergedResult = this._mergeAnalysisResults(fallbackResult, visionResult, {
                    mode: 'SEQUENTIAL'
                });
                fallbackTriggered = true;
                fallbackReason = this._deriveFallbackReason(extractionValidation);
                telemetry.setRouting(
                    {
                        category: plannerResult.category,
                        confidence: plannerResult.confidence,
                        modality: plannerResult.modality,
                        expertPipeline: plannerResult.routing?.expertPipeline
                    },
                    fallbackTriggered,
                    fallbackReason
                );
                const telemetryPayload = telemetry.finalize();
                logger.info('[TELEMETRY] ' + JSON.stringify(telemetryPayload));
                return {
                    ...mergedResult,
                    _analysisMode: 'VISION_WITH_FALLBACK',
                    _extractionMode: 'VISION_WITH_FALLBACK',
                    _primaryModel: config.ollama.visionModel,
                    _fallbackModel: this.model,
                    _fallbackUsed: true,
                    _fallbackReason: fallbackReason,
                    _validation: extractionValidation,
                    _planner: plannerResult,
                    _telemetry: telemetryPayload
                };
            }

            logger.info(`[VISION] Analysis completed in ${visionElapsedTime}s`);
            telemetry.setRouting(
                {
                    category: plannerResult.category,
                    confidence: plannerResult.confidence,
                    modality: plannerResult.modality,
                    expertPipeline: plannerResult.routing?.expertPipeline
                },
                fallbackTriggered,
                fallbackReason
            );
            const telemetryPayload = telemetry.finalize();
            logger.info('[TELEMETRY] ' + JSON.stringify(telemetryPayload));
            return {
                ...visionResult,
                _extractionMode: 'VISION_ONLY',
                _primaryModel: config.ollama.visionModel,
                _fallbackModel: null,
                _fallbackUsed: false,
                _validation: extractionValidation,
                _telemetry: telemetryPayload
            };
        } catch (error) {
            logger.error(`[VISION] Analysis failed: ${error.message}`);
            return {
                document: this._emptyDocument(),
                metrics: null,
                error: error.message
            };
        }
    },

    /**
     * Analyze document with vision model for classification (Planner stage)
     * Uses page 1 thumbnail to determine document category before extraction
     *
     * @param {number|string} documentId - Document ID
     * @returns {Promise<Object>} Classification result
     * @returns {string} return.category - Document category (financial, medical, legal, technical, personal, general)
     * @returns {string|null} return.doc_type_hint - Specific document type (invoice, befund, vertrag, etc.)
     * @returns {number} return.confidence - Classification confidence 0.0-1.0
     * @returns {string[]} return.keywords - Relevant keywords found in document
     * @returns {boolean} return.needs_visual - Whether document requires visual analysis (tables, forms, etc.)
     *
     * @example
     * const classification = await ollamaService.analyzeDocumentPlannerVision(1123);
     * // { category: 'financial', doc_type_hint: 'invoice', confidence: 0.9, keywords: ['rechnung', 'uid'], needs_visual: true }
     */
    async analyzeDocumentPlannerVision(documentId) {
        const defaultClassification = {
            category: 'general',
            doc_type_hint: null,
            modality: 'unknown',
            confidence: 0.5,
            keywords: [],
            needs_visual: false,
            rotation_degrees: 0
        };
        const applyRouting = (classification) => ({
            ...classification,
            routing: this._buildRoutingMetadata(classification)
        });

        try {
            logger.info(`[PLANNER] Starting classification for document ${documentId}`);

            const renderDpi = config.visualRag?.visionRenderDpi || 300;
            const base64Image = await this._loadPlannerImageAsBase64(documentId, renderDpi);
            if (!base64Image) {
                logger.info('[PLANNER] No render or thumbnail available, using default classification');
                return applyRouting(defaultClassification);
            }

            logger.info(`[PLANNER] Planner image loaded: ${base64Image.length} bytes at ${renderDpi} DPI`);

            const maxRetries = config.visualRag.maxRetriesPlanner;
            const plannerModel = config.ollama.plannerModel || config.ollama.visionModel;
            const hardening = this._getQwenPlannerHardening(plannerModel);

            for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
                const prompt = this.promptFactory.buildPlannerPrompt({
                    strict: attempt > 0,
                    bounded: hardening.enabled,
                    thinkingBudget: hardening.thinkingBudget,
                    outputBudget: hardening.outputBudget,
                    stopSequences: hardening.stopSequences
                });
                if (attempt > 0) {
                    logger.warn(`[PLANNER] Retry ${attempt}/${maxRetries}`);
                }

                logger.debug('[PLANNER] Calling vision API with planning prompt');

                const plannerLimits = this._resolveOllamaLimits('planner', plannerModel);
                const responseTokenBudget = hardening.enabled && hardening.responseTokens
                    ? hardening.responseTokens
                    : plannerLimits.maxResponseTokens;
                const templateMeta = this.promptFactory.getPlannerTemplateMeta({
                    strict: attempt > 0,
                    bounded: hardening.enabled,
                    thinkingBudget: hardening.thinkingBudget,
                    outputBudget: hardening.outputBudget
                });
                logger.info({
                    event: 'prompt_template_selected',
                    stage: 'planner',
                    model: plannerModel,
                    template: templateMeta,
                    responseTokens: responseTokenBudget,
                    contextWindow: plannerLimits.contextWindow,
                    bounded: hardening.enabled,
                    thinkingBudget: hardening.thinkingBudget,
                    outputBudget: hardening.outputBudget,
                    limitsSource: plannerLimits.source,
                    modelKey: plannerLimits.modelKey
                });
                const response = await this._callOllamaVisionAPI(prompt, base64Image, {
                    model: plannerModel,
                    kind: 'planner',
                    keep_alive: config.ollama.visionKeepAlive,
                    num_predict: responseTokenBudget,
                    temperature: 0.2,
                    num_ctx: plannerLimits.contextWindow,
                    stop: hardening.enabled ? hardening.stopSequences : null
                });

                const rawResponse = typeof response?.response === 'string'
                    ? response.response
                    : JSON.stringify(response?.response);
                if (rawResponse) {
                    // Raw response logging removed to avoid verbose logs and potential PII leakage
                } else {
                    // Raw response empty, continue
                }

                const thinkingTokens = this._extractThinkingTokens(response);
                if (thinkingTokens !== null) {
                    truncationMetrics.recordThinkingTokens(
                        'planner',
                        plannerModel,
                        thinkingTokens
                    );
                }

                const responseTruncated = !!response?._truncated;
                if (responseTruncated && attempt < maxRetries) {
                    logger.warn('[PLANNER] Response truncated, retrying');
                    continue;
                }

                let parsedResponse = null;
                if (response && typeof response.response === 'object') {
                    parsedResponse = response.response;
                } else {
                    parsedResponse = extractJsonFromResponse(response?.response);
                }

                // Remove high-cardinality parsed response logs

                const validation = this._validatePlannerResponse(parsedResponse);

                if (validation.valid) {
                    if (!parsedResponse.modality) {
                        parsedResponse.modality = 'unknown';
                    }
                    parsedResponse.rotation_degrees = this._normalizeRotationDegrees(
                        parsedResponse.rotation_degrees
                    );
                    return applyRouting(parsedResponse);
                }

                logger.warn(`[PLANNER] Invalid response structure: ${validation.errors.join(', ')}`);
            }

            return applyRouting(defaultClassification);
        } catch (error) {
            logger.error(`[PLANNER] Failed: ${error.message}`);
            return applyRouting(defaultClassification);
        }
    },

    async _handleThumbnailCaching(id) {
        if (!id) return;
        try {
            const cachePath = path.join('./public/images', `${id}.png`);
            await fs.access(cachePath).catch(async () => {
                const data = await paperlessService.getThumbnailImage(id);
                if (data) {
                    await fs.mkdir(path.dirname(cachePath), { recursive: true });
                    await fs.writeFile(cachePath, data);
                }
            });
        } catch (e) { void e; }
    },

    _normalizeRotationDegrees(value) {
        const parsed = Number.parseInt(value, 10);
        if ([0, 90, 180, 270].includes(parsed)) return parsed;
        return 0;
    },

    _getQwenPlannerHardening(plannerModel) {
        const hardening = config.ollama?.qwenRouterHardening || {};
        const modelName = typeof plannerModel === 'string'
            ? plannerModel.toLowerCase()
            : '';
        const enabledByConfig = hardening.enabled === 'yes'
            && modelName.includes('qwen3-vl');
        if (!enabledByConfig) {
            return {
                enabled: false,
                responseTokens: null,
                thinkingBudget: null,
                outputBudget: null,
                stopSequences: []
            };
        }

        const stats = truncationMetrics.getStats();
        const stageModelStats = stats.byStageModel?.planner?.[plannerModel];
        const totalRequests = stageModelStats?.totalRequests || 0;
        const truncations = (stageModelStats?.promptTruncations || 0)
            + (stageModelStats?.responseTruncations || 0);
        const truncationRate = totalRequests > 0 ? truncations / totalRequests : 0;
        const threshold = Number.isFinite(hardening.truncationThreshold)
            ? hardening.truncationThreshold
            : 0.02;
        const enabled = totalRequests > 0 && truncationRate > threshold;
        const thinkingBudget = Number.isFinite(hardening.thinkingTokens)
            ? hardening.thinkingTokens
            : null;
        const outputBudget = Number.isFinite(hardening.outputTokens)
            ? hardening.outputTokens
            : null;
        const responseTokens = Number.isFinite(thinkingBudget) && Number.isFinite(outputBudget)
            ? Math.max(1, thinkingBudget + outputBudget)
            : null;
        const stopSequences = Array.isArray(hardening.stopSequences)
            ? hardening.stopSequences
            : [];

        return {
            enabled,
            responseTokens,
            thinkingBudget,
            outputBudget,
            stopSequences
        };
    },

    _extractThinkingTokens(response) {
        if (!response) return null;
        if (typeof response.thinking === 'string') {
            return calculateTokens(response.thinking);
        }
        const rawText = typeof response.response === 'string'
            ? response.response
            : '';
        if (!rawText) return 0;
        const match = rawText.match(/<thinking>([\s\S]*?)<\/thinking>/i)
            || rawText.match(/<analysis>([\s\S]*?)<\/analysis>/i);
        if (match && match[1]) {
            return calculateTokens(match[1]);
        }
        return 0;
    },

    _relaxVisionValidation(validation) {
        if (!validation || validation.valid) return validation;
        const relaxable = new Set(['title', 'correspondent']);
        const errors = Array.isArray(validation.errors) ? validation.errors : [];
        const remainingErrors = errors.filter((message) => {
            const match = message.match(/Missing required field:\s*(.+)$/i);
            if (!match) return true;
            const field = match[1]?.trim();
            return !relaxable.has(field);
        });
        if (remainingErrors.length === 0) {
            return {
                ...validation,
                valid: true,
                errors: remainingErrors,
                warnings: [
                    ...(validation.warnings || []),
                    'Missing title/correspondent; using existing metadata'
                ]
            };
        }
        return validation;
    },

    async _clearVisionCache(documentId) {
        if (!documentId) return;
        const thumbnailPath = path.join(process.cwd(), 'public', 'images', `${documentId}.png`);
        await fs.unlink(thumbnailPath).catch(() => {});

        const renderDir = path.join(process.cwd(), 'public', 'images', 'rendered');
        try {
            const entries = await fs.readdir(renderDir);
            const prefix = `${documentId}_p`;
            await Promise.all(entries
                .filter(entry => entry.startsWith(prefix))
                .map(entry => fs.unlink(path.join(renderDir, entry)).catch(() => {})));
        } catch (error) {
            // Ignore cache clearing errors
            void error;
        }
    },

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    async _loadPlannerImageAsBase64(documentId, dpi = 300) {
        const rendered = await this._loadRenderedPageAsBase64(documentId, 1, dpi);
        if (rendered) {
            return rendered;
        }
        return this._loadThumbnailAsBase64(documentId);
    },

    /**
     * Load thumbnail image as base64 for vision analysis
     * @param {number|string} documentId - Document ID
     * @returns {Promise<string|null>} Base64 encoded image or null
     */
    async _loadThumbnailAsBase64(documentId) {
        const thumbnailPath = path.join(process.cwd(), 'public', 'images', `${documentId}.png`);
        try {
            const buffer = await fs.readFile(thumbnailPath);
            return buffer.toString('base64');
        } catch (e) {
            // Cache miss, attempt to fetch from Paperless
            void e;
        }

        try {
            const data = await paperlessService.getThumbnailImage(documentId);
            if (data) {
                await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });
                await fs.writeFile(thumbnailPath, data);
                return Buffer.from(data).toString('base64');
            }
        } catch (error) {
            logger.debug(`[VISION] Thumbnail fetch failed for doc ${documentId}: ${error.message}`);
        }

        logger.debug(`[VISION] No thumbnail for doc ${documentId}`);
        return null;
    },

    /**
     * Load rendered page image as base64 for vision extraction
     * Falls back to thumbnail if render is unavailable
     * @param {number|string} documentId - Document ID
     * @param {number} page - Page number (1-based)
     * @param {number} dpi - Render DPI
     * @returns {Promise<string|null>} Base64 encoded image or null
     */
    async _loadRenderedPageAsBase64(documentId, page = 1, dpi = (config.visualRag?.visionRenderDpi || 300)) {
        const renderDir = path.join(process.cwd(), 'public', 'images', 'rendered');
        const renderPath = path.join(renderDir, `${documentId}_p${page}_${dpi}.png`);

        try {
            const buffer = await fs.readFile(renderPath);
            return buffer.toString('base64');
        } catch (e) {
            // cache miss, continue to fetch
            void e;
        }

        try {
            // Try original document first, fallback to regular download if it fails
            let pdfBuffer = await paperlessService.downloadOriginalDocument(documentId);
            if (!pdfBuffer || pdfBuffer.length === 0) {
                logger.info(`[VISION] Original download unavailable, trying regular download for doc ${documentId}`);
                pdfBuffer = await paperlessService.downloadDocument(documentId);
            }

            if (pdfBuffer && pdfBuffer.length > 0) {
                if (!this._looksLikePdf(pdfBuffer)) {
                    if (this._looksLikeImage(pdfBuffer)) {
                        logger.info(`[VISION] Using original image for doc ${documentId} (non-PDF)`);
                        return pdfBuffer.toString('base64');
                    }
                    logger.warn(`[VISION] Original file is not a PDF for doc ${documentId}, skipping render`);
                    return null;
                }
                const canRender = await pdfRenderer.isAvailableAsync();
                if (canRender) {
                    const images = await pdfRenderer.renderBuffer(pdfBuffer, {
                        dpi,
                        docId: documentId,
                        maxPages: page
                    });
                    const target = images.find(img => img.page === page) || images[page - 1];
                    if (target?.base64) {
                        await fs.mkdir(renderDir, { recursive: true });
                        await fs.writeFile(renderPath, Buffer.from(target.base64, 'base64'));
                        return target.base64;
                    }
                } else {
                    logger.warn('[VISION] PDF renderer unavailable, skipping 300 DPI render');
                }
            }
        } catch (error) {
            logger.warn(`[VISION] Render failed for doc ${documentId} page ${page} at ${dpi} DPI: ${error.message}`);
        }

        logger.warn('[VISION] Rendered page unavailable, using thumbnail (degraded fidelity)');
        return this._loadThumbnailAsBase64(documentId);
    },

    /**
     * Call Ollama Vision API with image input
     * @param {string} prompt - Analysis prompt
     * @param {string} base64Image - Base64 encoded image
     * @param {Object} options - Additional options (keep_alive, etc.)
     * @returns {Promise<Object>} Ollama response
     */
    async _callOllamaVisionAPI(prompt, base64Image, options = {}) {
        try {
            // Debug logs removed for CI cleanliness; rely on higher-level info logs when needed
            const imageList = Array.isArray(base64Image) ? base64Image.filter(Boolean) : [base64Image];
            const imageBytes = imageList.reduce((total, img) => total + (img ? img.length : 0), 0);
            logger.debug(`[VISION] Image payload size: ${imageBytes} bytes`);

            const model = options.model || config.ollama.visionModel;
            const limitKind = options.kind || 'vision';
            const visionLimits = this._resolveOllamaLimits(limitKind, model);
            const imageTokenOverhead = config.ollama?.limits?.imageTokenOverhead || 1024;
            const promptTokens = calculateTokens(prompt);
            const imageTokens = imageList.length * imageTokenOverhead;
            let numCtx = Number.isFinite(options.num_ctx)
                ? options.num_ctx
                : visionLimits.contextWindow;
            let numPredict = Number.isFinite(options.num_predict)
                ? options.num_predict
                : visionLimits.maxResponseTokens;
            const temperature = Number.isFinite(options.temperature)
                ? options.temperature
                : 0.3;
            if (!Number.isFinite(numCtx) || numCtx <= 0) {
                numCtx = visionLimits.contextWindow;
            }
            if (!Number.isFinite(numPredict) || numPredict < 0) {
                numPredict = visionLimits.maxResponseTokens;
            }
            const stopSequences = Array.isArray(options.stop)
                ? options.stop.filter(Boolean)
                : [];
            const maxInputTokens = Math.max(0, numCtx - numPredict);
            const totalInputTokens = promptTokens + imageTokens;
            if (totalInputTokens > maxInputTokens) {
                const availableResponseTokens = Math.max(0, numCtx - totalInputTokens);
                if (availableResponseTokens < numPredict) {
                    logger.warn({
                        event: 'prompt_truncated',
                        stage: limitKind,
                        model,
                        reason: 'context_window',
                        promptTokens,
                        imageTokens,
                        totalInputTokens,
                        maxInputTokens,
                        numCtx,
                        numPredict,
                        adjustedNumPredict: availableResponseTokens,
                        limitsSource: visionLimits.source,
                        modelKey: visionLimits.modelKey
                    });
                    truncationMetrics.recordPromptTruncation(limitKind, model);
                    numPredict = availableResponseTokens;
                }
            }
            const visionOptions = {
                num_ctx: numCtx,
                num_predict: numPredict,
                temperature
            };
            if (stopSequences.length > 0) {
                visionOptions.stop = stopSequences;
            }

            truncationMetrics.recordRequest(limitKind, model);
            const response = await this.client.post(`${this.apiUrl}/api/generate`, {
                model,
                prompt: prompt,
                images: imageList,
                keep_alive: options.keep_alive || config.ollama.visionKeepAlive,
                stream: false,
                options: visionOptions
            });

            logger.debug('[DEBUG] Vision API response - status:', response.status);
            logger.debug('[DEBUG] Vision API response - has data:', !!response.data);
            logger.debug('[DEBUG] Vision API response - data type:', typeof response.data);
            this._logOllamaResponse('Vision API response - raw data:', response.data);

            if (response.status !== 200) throw new Error(`Ollama Vision Status: ${response.status}`);
            if (!response.data) throw new Error('No data in Ollama vision response');
            if (response.data.response === undefined) throw new Error('No response field in Ollama vision data');
            const doneReason = response.data?.done_reason;
            const evalCount = response.data?.eval_count;
            const truncated = doneReason === 'length'
                || (Number.isFinite(evalCount) && Number.isFinite(numPredict) && evalCount >= numPredict);
            if (truncated) {
                logger.warn({
                    event: 'response_truncated',
                    stage: limitKind,
                    model,
                    doneReason: doneReason || null,
                    evalCount: Number.isFinite(evalCount) ? evalCount : null,
                    numPredict,
                    numCtx,
                    limitsSource: visionLimits.source,
                    modelKey: visionLimits.modelKey
                });
                truncationMetrics.recordResponseTruncation(limitKind, model);
            }

            response.data._truncated = truncated;
            response.data._num_predict = numPredict;
            response.data._num_ctx = numCtx;

            return response.data;
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error(`Vision API timeout (${this.timeout}ms). Model loading?`);
            }
            logger.error('[ERROR] Vision API call failed:', error.message);
            throw error;
        }
    }
};

// Closing brace added to ensure module/function closure
}
