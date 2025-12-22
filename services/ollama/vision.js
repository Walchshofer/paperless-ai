const fs = require('fs').promises;
const path = require('path');
const config = require('../../config/config');
const paperlessService = require('../paperlessService');
const TelemetryCollector = require('../TelemetryCollector');
const expertRegistry = require('../ExpertRegistry');
const ExpertPipelineExecutor = require('../ExpertPipelineExecutor');
const { extractJsonFromResponse } = require('./utils');

module.exports = {
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
            console.log(`[VISION] Starting vision analysis for document ${documentId}`);

            let plannerResult;
            const plannerStage = telemetry.startStage('planner', config.ollama.visionModel);
            try {
                plannerResult = await this.analyzeDocumentPlannerVision(documentId);
                telemetry.endStage(plannerStage, true);
            } catch (error) {
                telemetry.endStage(plannerStage, false);
                console.warn('[VISION] Planner failed, using default profile');
                plannerResult = {
                    category: 'general',
                    doc_type_hint: null,
                    modality: 'unknown',
                    confidence: 0.5,
                    keywords: [],
                    needs_visual: true
                };
                plannerResult.routing = this._buildRoutingMetadata(plannerResult);
            }

            console.log('[VISION] Final classification:', JSON.stringify(plannerResult));

            // Load thumbnail
            const base64Image = await this._loadThumbnailAsBase64(documentId);
            if (!base64Image) {
                console.log('[VISION] Fallback to text: no thumbnail available');
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
                console.log('[TELEMETRY]', JSON.stringify(telemetryPayload));
                return { ...textResult, _planner: plannerResult, _telemetry: telemetryPayload };
            }

            // Initialize FieldProfiler
            await this.fieldProfiler.init();

            // Select profile based on classification
            const profileId = this.fieldProfiler.selectProfile(plannerResult);
            console.log(`[VISION] Using profile: ${profileId}`);
            console.log(`[PLANNER] Selected profile: ${profileId} (confidence: ${plannerResult.confidence})`);
            const fieldSet = this.fieldProfiler.getFieldSet(profileId);

            const renderDpi = config.visualRag.visionRenderDpi;
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
                    console.warn(`[VISION] Failed to fetch page count for ${documentId}: ${error.message}`);
                }
            }

            pagesToRender = [...new Set(pagesToRender)].slice(0, maxVisionPages);
            console.log(`[VISION] Rendering pages: ${pagesToRender.join(', ')} at ${renderDpi} DPI`);

            const renderedImages = [];
            for (const page of pagesToRender) {
                const rendered = await this._loadRenderedPageAsBase64(documentId, page, renderDpi);
                if (rendered) {
                    renderedImages.push(rendered);
                }
            }

            const extractionImages = renderedImages.length > 0 ? renderedImages : [base64Image];

            const maxRetries = Math.max(config.visualRag.maxRetriesExtractor, 2);
            let parsedResponse = null;
            let validation = { valid: false, errors: [] };
            const visionStage = telemetry.startStage('vision', config.ollama.visionModel);

            for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
                const prompt = this.promptFactory.buildVisionPrompt(fieldSet, fieldSet.profileName, { strict: attempt > 0 });
                if (attempt > 0) {
                    console.warn(`[VISION] Extraction retry ${attempt}/${maxRetries}`);
                }

                const response = await this._callOllamaVisionAPI(prompt, extractionImages);
                const rawText = this._extractRawOllamaText(response);
                try {
                    parsedResponse = this._processOllamaResponse(response);
                } catch (error) {
                    console.warn(`[VISION] Failed to parse response: ${error.message}`);
                    if (attempt < maxRetries) {
                        continue;
                    }
                    if (rawText) {
                        try {
                            console.warn('[VISION] Attempting repair with text model');
                            parsedResponse = await this._repairJsonWithTextModel(rawText);
                        } catch (repairError) {
                            console.error(`[VISION] Repair failed: ${repairError.message}`);
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
                validation = this.fieldProfiler.validateResult(parsedResponse, profileId);

                if (validation.valid) {
                    break;
                }

                console.warn(`[VISION] Extraction validation failed: ${validation.errors.join(', ')}`);
            }

            telemetry.endStage(visionStage, validation.valid);
            if (!validation.valid) {
                console.warn('[VISION] Extraction invalid after retries, falling back to text-only');
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
                console.log('[TELEMETRY]', JSON.stringify(telemetryPayload));
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
                const expertMatch = expertRegistry.matchExpert(plannerResult);
                if (expertMatch && plannerResult.routing?.expertPipeline) {
                    console.log(`[VISION] Triggering expert pipeline: ${expertMatch.domain}`);

                    const expertContext = {
                        documentId,
                        modality: plannerResult.modality || 'unknown',
                        doc_type_hint: plannerResult.doc_type_hint,
                        base64Image: extractionImages[0],
                        content,
                        visionResult: parsedResponse,
                        missingFields: extractionValidation.missingFields
                    };

                    const expertExecutor = new ExpertPipelineExecutor(this.promptFactory, this.client);
                    const expertResult = await expertExecutor.execute(
                        expertMatch.domain,
                        expertContext,
                        telemetry
                    );

                    if (expertResult) {
                        parsedResponse = this._mergeAnalysisResults(
                            { document: parsedResponse },
                            { document: expertResult }
                        ).document;
                        console.log(`[VISION] Expert pipeline merged ${Object.keys(expertResult).length} fields`);
                    }
                }
            }

            this._persistHealthMetrics(documentId, parsedResponse, plannerResult);

            if (extractionValidation.shouldFallback && fallbackEnabled) {
                console.log(`[FALLBACK] Triggering fallback for doc ${documentId}`);
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
                console.log('[TELEMETRY]', JSON.stringify(telemetryPayload));
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

            console.log(`[VISION] Analysis completed in ${visionElapsedTime}s`);
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
            console.log('[TELEMETRY]', JSON.stringify(telemetryPayload));
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
            console.error(`[VISION] Analysis failed: ${error.message}`);
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
            needs_visual: false
        };
        const applyRouting = (classification) => ({
            ...classification,
            routing: this._buildRoutingMetadata(classification)
        });

        try {
            console.log(`[PLANNER] Starting classification for document ${documentId}`);

            const base64Image = await this._loadThumbnailAsBase64(documentId);
            if (!base64Image) {
                console.log('[PLANNER] No thumbnail available, using default classification');
                return applyRouting(defaultClassification);
            }

            console.log(`[PLANNER] Thumbnail loaded: ${base64Image.length} bytes`);

            const maxRetries = config.visualRag.maxRetriesPlanner;

            for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
                const prompt = this.promptFactory.buildPlannerPrompt(attempt > 0);
                if (attempt > 0) {
                    console.warn(`[PLANNER] Retry ${attempt}/${maxRetries}`);
                }

                console.log('[PLANNER] Calling vision API with planning prompt');

                const response = await this._callOllamaVisionAPI(prompt, base64Image, {
                    keep_alive: config.ollama.visionKeepAlive,
                    num_predict: 700,
                    temperature: 0.2,
                    num_ctx: 8192
                });

                const rawResponse = typeof response?.response === 'string'
                    ? response.response
                    : JSON.stringify(response?.response);
                if (rawResponse) {
                    console.log(`[PLANNER] Raw response: ${rawResponse.substring(0, 200)}...`);
                } else {
                    console.log('[PLANNER] Raw response: <empty>');
                }

                let parsedResponse = null;
                if (response && typeof response.response === 'object') {
                    parsedResponse = response.response;
                } else {
                    parsedResponse = extractJsonFromResponse(response?.response);
                }

                console.log(`[PLANNER] Classification result: ${JSON.stringify(parsedResponse)}`);

                const validation = this._validatePlannerResponse(parsedResponse);
                console.log(`[PLANNER] Validation: ${validation.valid ? 'passed' : 'failed'}`);

                if (validation.valid) {
                    if (!parsedResponse.modality) {
                        parsedResponse.modality = 'unknown';
                    }
                    return applyRouting(parsedResponse);
                }

                console.warn(`[PLANNER] Invalid response structure: ${validation.errors.join(', ')}`);
            }

            return applyRouting(defaultClassification);
        } catch (error) {
            console.error(`[PLANNER] Failed: ${error.message}`);
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
        } catch (e) {}
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
            console.log(`[VISION] No thumbnail for doc ${documentId}`);
            return null;
        }
    },

    /**
     * Load rendered page image as base64 for vision extraction
     * Falls back to thumbnail if render is unavailable
     * @param {number|string} documentId - Document ID
     * @param {number} page - Page number (1-based)
     * @param {number} dpi - Render DPI
     * @returns {Promise<string|null>} Base64 encoded image or null
     */
    async _loadRenderedPageAsBase64(documentId, page = 1, dpi = 150) {
        const renderDir = path.join(process.cwd(), 'public', 'images', 'rendered');
        const renderPath = path.join(renderDir, `${documentId}_p${page}_${dpi}.png`);

        try {
            const buffer = await fs.readFile(renderPath);
            return buffer.toString('base64');
        } catch (e) {
            // cache miss, continue to fetch
        }

        try {
            if (typeof paperlessService.initialize === 'function') {
                paperlessService.initialize();
            }

            if (!paperlessService.client) {
                console.warn('[VISION] Paperless client not initialized for render');
            } else {
                const response = await paperlessService.client.get(`/documents/${documentId}/thumb/`, {
                    responseType: 'arraybuffer',
                    params: { page, dpi }
                });

                if (response?.data?.byteLength > 0) {
                    await fs.mkdir(renderDir, { recursive: true });
                    await fs.writeFile(renderPath, response.data);
                    return Buffer.from(response.data).toString('base64');
                }
            }
        } catch (error) {
            console.warn(`[VISION] Render fetch failed for doc ${documentId} page ${page}: ${error.message}`);
        }

        console.warn('[VISION] Rendered page unavailable, using thumbnail (degraded fidelity)');
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
            console.log('[DEBUG] Calling Ollama Vision API');
            console.log('[DEBUG] Vision model:', config.ollama.visionModel);
            console.log('[DEBUG] Prompt length:', prompt.length);
            const imageList = Array.isArray(base64Image) ? base64Image.filter(Boolean) : [base64Image];
            const imageBytes = imageList.reduce((total, img) => total + (img ? img.length : 0), 0);
            console.log('[DEBUG] Image count:', imageList.length);
            console.log('[DEBUG] Image size:', imageBytes, 'bytes');

            const visionOptions = {
                num_ctx: options.num_ctx || 32768,
                num_predict: options.num_predict || 1600,
                temperature: options.temperature || 0.3
            };

            const response = await this.client.post(`${this.apiUrl}/api/generate`, {
                model: config.ollama.visionModel,
                prompt: prompt,
                images: imageList,
                keep_alive: options.keep_alive || config.ollama.visionKeepAlive,
                stream: false,
                options: visionOptions
            });

            console.log('[DEBUG] Vision API response - status:', response.status);
            console.log('[DEBUG] Vision API response - has data:', !!response.data);
            console.log('[DEBUG] Vision API response - data type:', typeof response.data);
            this._logOllamaResponse('Vision API response - raw data:', response.data);

            if (response.status !== 200) throw new Error(`Ollama Vision Status: ${response.status}`);
            if (!response.data) throw new Error('No data in Ollama vision response');
            if (response.data.response === undefined) throw new Error('No response field in Ollama vision data');

            return response.data;
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error(`Vision API timeout (${this.timeout}ms). Model loading?`);
            }
            console.error('[ERROR] Vision API call failed:', error.message);
            throw error;
        }
    }
};
