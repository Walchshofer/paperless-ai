const axios = require('axios');
const config = require('../config/config');
const fs = require('fs').promises;
const path = require('path');
const paperlessService = require('./paperlessService');
const os = require('os');
const RestrictionPromptService = require('./restrictionPromptService');
const FieldProfiler = require('./visual-rag/FieldProfiler');

// ============================================================================
//  INTERNAL UTILITIES (Inlined to prevent loading errors)
// ============================================================================

function calculateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    // Llama/Qwen/GPT-OSS tokenizer estimate: ~3.5 chars per token
    return Math.ceil(text.length / 3.5);
}

function truncateToTokenLimit(content, maxTokens) {
    if (!content) return '';
    const maxChars = maxTokens * 3.5;
    if (content.length <= maxChars) return content;

    let truncated = content.substring(0, maxChars);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > maxChars * 0.8) {
        truncated = content.substring(0, lastPeriod + 1);
    }
    return truncated;
}

function validateDocumentContent(content, minChars = 50) {
    if (!content) return { valid: false, reason: 'Content is empty' };
    if (typeof content !== 'string') return { valid: false, reason: 'Content is not a string' };

    const trimmed = content.trim();
    if (trimmed.length < minChars) {
        return { valid: false, reason: `Content too short (${trimmed.length}/${minChars} chars)` };
    }
    return { valid: true, reason: 'Content is valid' };
}

async function writePromptToFile(content) {
    try {
        const logsPath = path.join(process.cwd(), 'logs', 'prompts');
        await fs.mkdir(logsPath, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('Z')[0];
        const filename = `prompt_${timestamp}.log`;
        await fs.writeFile(path.join(logsPath, filename), `[${new Date().toISOString()}]\n\n${content}`, { encoding: 'utf-8' });
    } catch (e) { /* ignore log errors */ }
}

function extractJsonFromResponse(responseText) {
    if (!responseText || typeof responseText !== 'string') return null;
    try { return JSON.parse(responseText); } catch (e) {}
    const match = responseText.match(/\{[\s\S]*\}/);
    if (match) {
        try { return JSON.parse(match[0]); } catch (e) {}
    }
    return null;
}

// ============================================================================
//  MAIN SERVICE CLASS
// ============================================================================

class OllamaService {
    constructor() {
        this.apiUrl = config.ollama.apiUrl;
        this.model = config.ollama.model;

        // FIX: Dynamic Timeout Configuration
        const timeoutMs = parseInt(process.env.AXIOS_TIMEOUT, 10);
        this.timeout = (!isNaN(timeoutMs) && timeoutMs >= 5000) ? timeoutMs : 600000;

        console.log(`[INFO] Ollama Service initialized. Model: ${this.model}, Timeout: ${this.timeout}ms`);

        this.client = axios.create({
            timeout: this.timeout
        });

        this.isGptOss = this.model.toLowerCase().includes('gpt-oss');

        // Initialize FieldProfiler for Visual RAG
        this.fieldProfiler = new FieldProfiler();

        this.documentAnalysisSchema = {
            type: "object",
            properties: {
                title: { type: "string" },
                correspondent: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                document_type: { type: "string" },
                document_date: { type: "string" },
                language: { type: "string" },
                custom_fields: { type: "object", additionalProperties: true }
            },
            required: ["title", "correspondent", "tags", "document_type", "document_date", "language"]
        };

        // Standard playground schema
        this.playgroundSchema = this.documentAnalysisSchema;
    }

    /**
     * Analyze document using sequential text-then-vision pipeline
     * @param {number|string} documentId - Document ID
     * @param {string} content - Document text content
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Merged analysis result
     */
    async analyzeDocumentSequential(documentId, content, options = {}) {
        const startTime = Date.now();
        try {
            console.log(`[SEQUENTIAL] Starting sequential analysis for document ${documentId}`);

            // 1. Text analysis first
            console.log('[SEQUENTIAL] Step 1: Text analysis');
            const textResult = await this._analyzeDocumentText(
                content,
                options.existingTags || [],
                options.existingCorrespondentList || [],
                options.existingDocumentTypesList || [],
                documentId,
                null,
                options
            );

            // 2. Check if text quality is sufficient
            const quality = this._assessTextQuality(content);
            console.log(`[SEQUENTIAL] Text quality: ${quality}, Threshold: ${config.visualRag.textQualityThreshold}`);

            if (quality >= config.visualRag.textQualityThreshold) {
                console.log('[SEQUENTIAL] Text quality sufficient, skipping vision analysis');
                textResult._analysisMode = 'SEQUENTIAL_TEXT_ONLY';
                return textResult;
            }

            // 3. Vision analysis to enhance results
            console.log('[SEQUENTIAL] Step 2: Vision analysis for enhancement');
            const visionResult = await this.analyzeDocumentWithVision(documentId, content, options);

            // 4. Merge results
            console.log('[SEQUENTIAL] Step 3: Merging results');
            const mergedResult = this._mergeAnalysisResults(textResult, visionResult, {
                quality,
                threshold: config.visualRag.textQualityThreshold,
                mode: 'SEQUENTIAL'
            });

            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[SEQUENTIAL] Analysis completed in ${elapsedTime}s`);

            return mergedResult;

        } catch (error) {
            console.error(`[SEQUENTIAL] Analysis failed: ${error.message}`);
            return {
                document: this._emptyDocument(),
                metrics: null,
                error: error.message
            };
        }
    }

    /**
     * Merge text and vision analysis results
     * Vision results take priority for visual elements (tables, amounts)
     * Text results used for language and contextual understanding
     * @param {Object} textResult - Result from text analysis
     * @param {Object} visionResult - Result from vision analysis
     * @returns {Object} Merged result
     */
    _mergeAnalysisResults(textResult, visionResult, options = {}) {
        const textDoc = textResult.document || {};
        const visionDoc = visionResult.document || {};
        const threshold = options.threshold ?? config.visualRag.textQualityThreshold;
        const preferVisionFields = options.mode === 'SEQUENTIAL'
            || (typeof options.quality === 'number' && options.quality < threshold);

        // Merge tags: union, deduplicated
        const mergedTags = [...new Set([
            ...(textDoc.tags || []),
            ...(visionDoc.tags || [])
        ])];

        // Vision takes priority for correspondent (better at reading letterheads)
        const correspondent = visionDoc.correspondent || textDoc.correspondent;

        // Vision takes priority for title (better at reading headers)
        const title = visionDoc.title || textDoc.title;

        // Vision takes priority for document_type when text quality is weak or in sequential mode
        const document_type = preferVisionFields
            ? (visionDoc.document_type || textDoc.document_type)
            : (textDoc.document_type || visionDoc.document_type);

        // Prefer vision for date when text quality is weak or in sequential mode
        const document_date = preferVisionFields
            ? (visionDoc.document_date || textDoc.document_date)
            : (textDoc.document_date || visionDoc.document_date);

        // Prefer text for language detection
        const language = textDoc.language || visionDoc.language;

        // Merge custom fields: vision takes priority (better at reading tables/amounts)
        const custom_fields = {
            ...(textDoc.custom_fields || {}),
            ...(visionDoc.custom_fields || {})
        };

        return {
            document: {
                title,
                correspondent,
                tags: mergedTags,
                document_type,
                document_date,
                language,
                custom_fields
            },
            metrics: {
                promptTokens: (textResult.metrics?.promptTokens || 0) + (visionResult.metrics?.promptTokens || 0),
                completionTokens: (textResult.metrics?.completionTokens || 0) + (visionResult.metrics?.completionTokens || 0),
                totalTokens: (textResult.metrics?.totalTokens || 0) + (visionResult.metrics?.totalTokens || 0),
                processingTime: (parseFloat(textResult.metrics?.processingTime || 0) + parseFloat(visionResult.metrics?.processingTime || 0)).toFixed(2)
            },
            truncated: textResult.truncated || visionResult.truncated || false,
            _analysisMode: 'SEQUENTIAL',
            _sources: {
                text: textDoc,
                vision: visionDoc
            }
        };
    }

    /**
     * Analyze document using vision model
     * @param {number|string} documentId - Document ID
     * @param {string} content - Document text content (for classification)
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeDocumentWithVision(documentId, content, options = {}) {
        const startTime = Date.now();
        try {
            console.log(`[VISION] Starting vision analysis for document ${documentId}`);

            let plannerResult;
            try {
                plannerResult = await this.analyzeDocumentPlannerVision(documentId);
            } catch (error) {
                console.warn('[VISION] Planner failed, using default profile');
                plannerResult = {
                    category: 'general',
                    doc_type_hint: null,
                    confidence: 0.5,
                    keywords: [],
                    needs_visual: true
                };
            }
            console.log('[VISION] Planner classification:', JSON.stringify(plannerResult));

            // Load thumbnail
            const base64Image = await this._loadThumbnailAsBase64(documentId);
            if (!base64Image) {
                console.log('[VISION] Fallback to text: no thumbnail available');
                const textResult = await this._analyzeDocumentText(
                    content,
                    options.existingTags || [],
                    options.existingCorrespondentList || [],
                    options.existingDocumentTypesList || [],
                    documentId,
                    null,
                    options
                );
                return { ...textResult, _planner: plannerResult };
            }

            // Initialize FieldProfiler
            await this.fieldProfiler.init();

            // Select profile based on classification
            const profileId = this.fieldProfiler.selectProfile(plannerResult);
            console.log(`[VISION] Using profile: ${profileId}`);
            console.log(`[PLANNER] Selected profile: ${profileId} (confidence: ${plannerResult.confidence})`);

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

            const maxRetries = config.visualRag.maxRetriesExtractor;
            let parsedResponse = null;
            let validation = { valid: false, errors: [] };

            for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
                const prompt = this.fieldProfiler.generateExtractionPrompt(profileId, { strict: attempt > 0 });
                if (attempt > 0) {
                    console.warn(`[VISION] Extraction retry ${attempt}/${maxRetries}`);
                }

                const response = await this._callOllamaVisionAPI(prompt, extractionImages);
                parsedResponse = this._processOllamaResponse(response);
                validation = this.fieldProfiler.validateResult(parsedResponse, profileId);

                if (validation.valid) {
                    break;
                }

                console.warn(`[VISION] Extraction validation failed: ${validation.errors.join(', ')}`);
            }

            if (!validation.valid) {
                console.warn('[VISION] Extraction invalid after retries, falling back to text-only');
                const textResult = await this._analyzeDocumentText(
                    content,
                    options.existingTags || [],
                    options.existingCorrespondentList || [],
                    options.existingDocumentTypesList || [],
                    documentId,
                    null,
                    options
                );
                return { ...textResult, _planner: plannerResult };
            }

            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[VISION] Analysis completed in ${elapsedTime}s`);

            return {
                document: parsedResponse,
                metrics: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    processingTime: elapsedTime
                },
                truncated: false,
                _analysisMode: 'VISION_ONLY',
                _planner: plannerResult
            };

        } catch (error) {
            console.error(`[VISION] Analysis failed: ${error.message}`);
            return {
                document: this._emptyDocument(),
                metrics: null,
                error: error.message
            };
        }
    }

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
     * const classification = await ollamaService.analyzeDocumentPlannerVision(123);
     * // { category: 'financial', doc_type_hint: 'invoice', confidence: 0.9, keywords: ['rechnung', 'uid'], needs_visual: true }
     */
    async analyzeDocumentPlannerVision(documentId) {
        const defaultClassification = {
            category: 'general',
            doc_type_hint: null,
            confidence: 0.5,
            keywords: [],
            needs_visual: false
        };

        try {
            console.log(`[PLANNER] Starting classification for document ${documentId}`);

            const base64Image = await this._loadThumbnailAsBase64(documentId);
            if (!base64Image) {
                console.log('[PLANNER] No thumbnail available, using default classification');
                return defaultClassification;
            }

            console.log(`[PLANNER] Thumbnail loaded: ${base64Image.length} bytes`);

            const maxRetries = config.visualRag.maxRetriesPlanner;

            for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
                const prompt = this._generatePlannerPrompt(attempt > 0);
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
                    return parsedResponse;
                }

                console.warn(`[PLANNER] Invalid response structure: ${validation.errors.join(', ')}`);
            }

            return defaultClassification;
        } catch (error) {
            console.error(`[PLANNER] Failed: ${error.message}`);
            return defaultClassification;
        }
    }

    /**
     * Main document analysis entry point with routing
     * Routes to TEXT_ONLY, VISION_ONLY, or SEQUENTIAL based on content quality and config
     * @param {string} content - Document text content
     * @param {Array} existingTags - Existing tags from Paperless
     * @param {Array} existingCorrespondentList - Existing correspondents
     * @param {Array} existingDocumentTypesList - Existing document types
     * @param {number|string} id - Document ID
     * @param {string|null} customPrompt - Optional custom prompt
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeDocument(content, existingTags = [], existingCorrespondentList = [], existingDocumentTypesList = [], id, customPrompt = null, options = {}) {
        try {
            // Determine analysis mode based on content quality and configuration
            const mode = this._determineAnalysisMode(content);
            console.log(`[ANALYSIS] Document ${id} - Mode: ${mode}`);

            // Store options for nested calls
            const enrichedOptions = {
                ...options,
                existingTags,
                existingCorrespondentList,
                existingDocumentTypesList
            };

            // Route to appropriate analysis method
            switch (mode) {
                case 'VISION_ONLY':
                    return await this.analyzeDocumentWithVision(id, content, enrichedOptions);

                case 'SEQUENTIAL':
                    return await this.analyzeDocumentSequential(id, content, enrichedOptions);

                case 'TEXT_ONLY':
                default:
                    return await this._analyzeDocumentText(content, existingTags, existingCorrespondentList, existingDocumentTypesList, id, customPrompt, options);
            }

        } catch (error) {
            console.error(`[ANALYSIS] Failed for document ${id}: ${error.message}`);
            return {
                document: this._emptyDocument(),
                metrics: null,
                error: error.message
            };
        }
    }

    /**
     * Internal text-only analysis method
     * @private
     */
    async _analyzeDocumentText(content, existingTags = [], existingCorrespondentList = [], existingDocumentTypesList = [], id, customPrompt = null, options = {}) {
        const startTime = Date.now();
        try {
            console.log(`[TEXT] Starting text-only analysis for ID: ${id}`);

            // 1. Validation
            const validation = validateDocumentContent(content);
            if (!validation.valid) {
                console.warn(`[WARN] Content validation: ${validation.reason}. Proceeding anyway.`);
            }

            // 2. Truncate
            const maxTokens = parseInt(process.env.TOKEN_LIMIT || '16384', 10);
            const contentTokenLimit = Math.max(1000, maxTokens - 1500);
            content = truncateToTokenLimit(content, contentTokenLimit);

            await this._handleThumbnailCaching(id);

            // Get external API data if available and validate it
            let externalApiData = options.externalApiData || null;
            let validatedExternalApiData = null;

            if (externalApiData) {
                try {
                    validatedExternalApiData = await this._validateAndTruncateExternalApiData(externalApiData);
                    console.log('[DEBUG] External API data validated and included');
                } catch (error) {
                    console.warn('[WARNING] External API data validation failed:', error.message);
                    validatedExternalApiData = null;
                }
            }

            // 3. Build Prompt
            let prompt;
            if (!customPrompt) {
                prompt = this._buildPrompt(content, existingTags, existingCorrespondentList, existingDocumentTypesList, options);
            } else {
                // Parse CUSTOM_FIELDS for custom prompt
                let customFieldsObj;
                try {
                    customFieldsObj = JSON.parse(process.env.CUSTOM_FIELDS || '{}');
                } catch (error) {
                    console.error('Failed to parse CUSTOM_FIELDS:', error);
                    customFieldsObj = { custom_fields: [] };
                }

                const customFieldsTemplate = {};
                customFieldsObj.custom_fields.forEach((field) => {
                    if (field?.value) {
                        customFieldsTemplate[field.value] = null;
                    }
                });

                const customFieldsStr = '"custom_fields": ' + JSON.stringify(customFieldsTemplate, null, 2)
                    .split('\n')
                    .map(line => '    ' + line)
                    .join('\n');

                prompt = customPrompt + '\n\n' + config.mustHavePrompt.replace('%CUSTOMFIELDS%', customFieldsStr) + "\n\n" + JSON.stringify(content);
                console.log('[DEBUG] Ollama Service started with custom prompt');
            }

            const customFieldsStr = this._generateCustomFieldsTemplate();
            const systemPrompt = this._generateSystemPrompt(customFieldsStr);

            // 4. Calculate Context - MUST include both system prompt AND user prompt
            const systemPromptTokens = calculateTokens(systemPrompt);
            const promptTokenCount = calculateTokens(prompt);
            const totalInputTokens = systemPromptTokens + promptTokenCount;
            const expectedResponseTokens = 2048;  // Matches num_predict for full JSON with custom_fields
            const numCtx = this._calculateNumCtx(totalInputTokens, expectedResponseTokens);

            console.log(`[DEBUG] Tokens: ${totalInputTokens} (system: ${systemPromptTokens}, prompt: ${promptTokenCount}), Context: ${numCtx}, Model: ${this.model}`);
            console.log(`[DEBUG] Use existing data: ${config.useExistingData}, External API: ${validatedExternalApiData ? 'included' : 'none'}`);

            // 5. Call API
            const response = await this._callOllamaAPI(prompt, systemPrompt, numCtx, this.documentAnalysisSchema);

            // 6. Process Response
            const parsedResponse = this._processOllamaResponse(response);

            // Check for missing data
            if (parsedResponse.tags.length === 0 && parsedResponse.correspondent === null) {
                console.warn('No tags or correspondent found in response from Ollama. Review your prompt or switch to OpenAI.');
            }

            await writePromptToFile(prompt + "\n\nRESPONSE:\n" + JSON.stringify(parsedResponse));

            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[SUCCESS] Analysis completed in ${elapsedTime}s`);

            return {
                document: parsedResponse,
                metrics: { promptTokens: promptTokenCount, completionTokens: 0, totalTokens: promptTokenCount, processingTime: elapsedTime },
                truncated: false
            };

        } catch (error) {
            console.error(`[ERROR] Analysis failed: ${error.message}`);
            return {
                document: this._emptyDocument(),
                metrics: null,
                error: error.message
            };
        }
    }

    _calculateNumCtx(promptTokenCount, responseTokens) {
        const total = promptTokenCount + responseTokens;
        const maxLimit = parseInt(process.env.TOKEN_LIMIT || '16384', 10);
        // Use 90% if GPT-OSS, else 80%
        const factor = this.isGptOss ? 0.90 : 0.80;
        const safeLimit = Math.floor(maxLimit * factor);
        return Math.min(total, safeLimit);
    }

    async _callOllamaAPI(prompt, systemPrompt, numCtx, schema) {
        try {
            // DEBUG: Log request details
            console.log('[DEBUG] Ollama API request - system prompt length:', systemPrompt.length);
            console.log('[DEBUG] Ollama API request - prompt length:', prompt.length);
            console.log('[DEBUG] Ollama API request - numCtx:', numCtx);

            // NOTE: gpt-oss doesn't support the 'format' parameter for JSON schema
            // JSON output is requested via the system prompt instead
            const res = await this.client.post(`${this.apiUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                system: systemPrompt,
                keep_alive: config.ollama.textKeepAlive,
                stream: false,
                // format: schema,  // REMOVED: gpt-oss doesn't support this
                options: {
                    temperature: 0.35,
                    top_p: 0.9,
                    repeat_penalty: 1.1,
                    top_k: 7,
                    num_predict: 2048,  // Increased to allow full JSON response with custom_fields
                    num_ctx: numCtx
                }
            });

            console.log('[DEBUG] Ollama API response - status:', res.status);
            console.log('[DEBUG] Ollama API response - has data:', !!res.data);
            console.log('[DEBUG] Ollama API response - response length:', res.data?.response?.length || 0);

            if (res.status !== 200) throw new Error(`Ollama Status: ${res.status}`);
            if (!res.data) throw new Error('No data in Ollama response');
            // Allow empty response string - will be parsed as JSON below
            if (res.data.response === undefined) throw new Error('No response field in Ollama data');

            return res.data;
        } catch (error) {
            if (error.code === 'ECONNABORTED') throw new Error(`Timeout (${this.timeout}ms). Model loading?`);
            throw error;
        }
    }

    _processOllamaResponse(responseData) {
        // Log raw response for debugging
        console.log('[DEBUG] Raw Ollama response:', JSON.stringify(responseData.response).substring(0, 500));

        if (responseData.response && typeof responseData.response === 'object') {
            return this._normalize(responseData.response);
        }
        if (typeof responseData.response === 'string') {
            const extracted = extractJsonFromResponse(responseData.response);
            if (extracted) return this._normalize(extracted);
            try {
                return this._normalize(JSON.parse(responseData.response));
            } catch(e) {
                console.error('[ERROR] Failed to parse JSON. Response was:', responseData.response);
                throw new Error('Could not parse JSON from response');
            }
        }
        throw new Error('Invalid response structure');
    }

    _normalize(data) {
        const normalizedData = (data && typeof data === 'object') ? data : {};
        const customFields = (normalizedData && typeof normalizedData.custom_fields === 'object' && !Array.isArray(normalizedData.custom_fields))
            ? normalizedData.custom_fields
            : {};

        return {
            tags: Array.isArray(normalizedData.tags) ? normalizedData.tags : [],
            correspondent: normalizedData.correspondent || null,
            title: normalizedData.title || null,
            document_date: normalizedData.document_date || null,
            document_type: normalizedData.document_type || null,
            language: normalizedData.language || null,
            custom_fields: customFields
        };
    }

    _emptyDocument() {
        return {
            title: null,
            correspondent: null,
            tags: [],
            document_type: null,
            document_date: null,
            language: null,
            custom_fields: {}
        };
    }

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
    }

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
    }

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
    }

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

    _validatePlannerResponse(response) {
        const errors = [];
        const allowedCategories = ['financial', 'medical', 'legal', 'technical', 'personal', 'general'];

        if (!response || typeof response !== 'object' || Array.isArray(response)) {
            errors.push('response is not an object');
            return { valid: false, errors };
        }

        const requiredFields = ['category', 'doc_type_hint', 'confidence', 'keywords', 'needs_visual'];
        requiredFields.forEach((field) => {
            if (!(field in response)) {
                errors.push(`missing ${field}`);
            }
        });

        if (typeof response.category !== 'string' || !allowedCategories.includes(response.category)) {
            errors.push('invalid category');
        }

        if ('doc_type_hint' in response && response.doc_type_hint !== null && typeof response.doc_type_hint !== 'string') {
            errors.push('invalid doc_type_hint');
        }

        if (typeof response.confidence !== 'number' || Number.isNaN(response.confidence) || response.confidence < 0 || response.confidence > 1) {
            errors.push('invalid confidence');
        }

        if (!Array.isArray(response.keywords)) {
            errors.push('invalid keywords');
        }

        if (typeof response.needs_visual !== 'boolean') {
            errors.push('invalid needs_visual');
        }

        return { valid: errors.length === 0, errors };
    }

    async _validateAndTruncateExternalApiData(apiData, maxTokens = 500) {
        if (!apiData) return null;

        const dataString = typeof apiData === 'object'
            ? JSON.stringify(apiData, null, 2)
            : String(apiData);

        const dataTokens = calculateTokens(dataString);

        if (dataTokens > maxTokens) {
            console.warn(`[WARNING] External API data (${dataTokens} tokens) exceeds limit (${maxTokens}), truncating`);
            return truncateToTokenLimit(dataString, maxTokens);
        }

        console.log(`[DEBUG] External API data validated: ${dataTokens} tokens`);
        return dataString;
    }

    /**
     * Assess text quality score (0-100)
     * Higher scores indicate better OCR quality
     * @param {string} content - Document text content
     * @returns {number} Quality score 0-100
     */
    _assessTextQuality(content) {
        if (!content || content.length < 50) return 0;

        const words = content.split(/\s+/);
        const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
        const specialCharRatio = (content.match(/[^\w\s]/g) || []).length / content.length;

        let score = 100;

        // Penalize short average word length (OCR artifacts)
        if (avgWordLength < 3) score -= 30;

        // Penalize high special character ratio (OCR noise)
        if (specialCharRatio > 0.15) score -= 30;

        // Penalize very short documents
        if (words.length < 20) score -= 20;

        return Math.max(0, score);
    }

    /**
     * Detect visual complexity patterns in text
     * @param {string} content - Document text content
     * @returns {string[]} Array of detected patterns (table, form, columns)
     */
    _detectVisualComplexity(content) {
        const flags = [];

        // Detect tables (multiple pipe characters)
        if ((content.match(/\|/g) || []).length > 5) {
            flags.push('table');
        }

        // Detect forms (checkbox patterns)
        if (/\[\s*[xX]?\s*\]/.test(content)) {
            flags.push('form');
        }

        // Detect multi-column layout (multiple spaces between words)
        if (/^\s{2,}\S+\s{2,}\S+/m.test(content)) {
            flags.push('columns');
        }

        return flags;
    }

    /**
     * Determine analysis mode based on text quality and configuration
     * @param {string} content - Document text content
     * @returns {string} Analysis mode: TEXT_ONLY, VISION_ONLY, or SEQUENTIAL
     */
    _determineAnalysisMode(content) {
        // If Visual RAG is disabled, use text-only mode
        if (!config.visualRag.enabled) {
            return 'TEXT_ONLY';
        }

        // If force vision is enabled, always use vision
        if (config.visualRag.forceVision) {
            return 'VISION_ONLY';
        }

        // Assess text quality
        const quality = this._assessTextQuality(content);
        const complexity = this._detectVisualComplexity(content);

        console.log(`[ANALYSIS] Text quality: ${quality}, Complexity flags: ${complexity.join(', ') || 'none'}`);

        // Very low quality - go straight to vision
        if (quality < 40) {
            return 'VISION_ONLY';
        }

        // High quality and low complexity - text is sufficient
        if (quality >= 70 && complexity.length < 2) {
            return 'TEXT_ONLY';
        }

        // Medium quality or complex layout - use sequential analysis
        return 'SEQUENTIAL';
    }

    _generatePlannerPrompt(strict = false) {
        const basePrompt = 'AT/DE doc classifier. Choose ONE: financial, medical, legal, technical, personal, general. Hints: financial=Rechnung/Quittung/Honorarnote/Bank, medical=Befund/Rezept/Arztbrief, legal=Vertrag/Vereinbarung/GZ, technical=Anleitung/Datenblatt, personal=Brief/Mitteilung/Schreiben. Return ONLY JSON: {"category":"financial|medical|legal|technical|personal|general","doc_type_hint":"invoice|lab_report|contract|...","confidence":0-1,"keywords":["..."],"needs_visual":true|false}. Rules: doc_type_hint specific; confidence>=0.8 clear, 0.5-0.8 maybe, <0.5 unsure; keywords 2-5 DE/EN; needs_visual true if tables/forms/stamps/complex layout.';
        if (strict) {
            return `${basePrompt} STRICT MODE: JSON only, no extra keys.`;
        }
        return basePrompt;
    }

    _generateCustomFieldsTemplate() {
        try {
            const obj = JSON.parse(process.env.CUSTOM_FIELDS || '{"custom_fields":[]}');
            const tpl = {};
            obj.custom_fields.forEach((f) => {
                if (f?.value) {
                    tpl[f.value] = null;
                }
            });
            return '"custom_fields": ' + JSON.stringify(tpl, null, 2).split('\n').map(l => '    ' + l).join('\n');
        } catch (e) { return ""; }
    }

    _generateSystemPrompt(customFieldsStr) {
        let systemPromptTemplate = `
            You are a document analyzer. Your task is to analyze documents and extract relevant information. You do not ask back questions.
            YOU MUSTNOT: Ask for additional information or clarification, or ask questions about the document, or ask for additional context.
            YOU MUSTNOT: Return a response without the desired JSON format.
            YOU MUST: Return the result EXCLUSIVELY as a JSON object. The Tags, Title and Document_Type MUST be in the language that is used in the document.:
            IMPORTANT: The custom_fields are optional and can be left out if not needed, only try to fill out the values if you find a matching information in the document.
            custom_fields keys are fixed IDs; do not invent or rename keys. Use null when unknown. If the field is about money only add the number without currency and always use a . for decimal places.
            {
                "title": "xxxxx",
                "correspondent": "xxxxxxxx",
                "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
                "document_type": "Invoice/Contract/...",
                "document_date": "YYYY-MM-DD",
                "language": "en/de/es/...",
                %CUSTOMFIELDS%
            }
            ALWAYS USE THE INFORMATION TO FILL OUT THE JSON OBJECT. DO NOT ASK BACK QUESTIONS.
        `;

        return systemPromptTemplate.replace('%CUSTOMFIELDS%', customFieldsStr);
    }

    _buildPrompt(content, existingTags = [], existingCorrespondent = [], existingDocumentTypes = [], options = {}) {
        let systemPrompt;

        // Validate that existingCorrespondent is an array and handle if it's not
        const correspondentList = Array.isArray(existingCorrespondent)
            ? existingCorrespondent
            : [];

        // Parse CUSTOM_FIELDS from environment variable
        let customFieldsObj;
        try {
            customFieldsObj = JSON.parse(process.env.CUSTOM_FIELDS || '{}');
        } catch (error) {
            console.error('Failed to parse CUSTOM_FIELDS:', error);
            customFieldsObj = { custom_fields: [] };
        }

        // Generate custom fields template for the prompt
        const customFieldsTemplate = {};

        customFieldsObj.custom_fields.forEach((field) => {
            if (field?.value) {
                customFieldsTemplate[field.value] = null;
            }
        });

        // Convert template to string for replacement and wrap in custom_fields
        const customFieldsStr = '"custom_fields": ' + JSON.stringify(customFieldsTemplate, null, 2)
            .split('\n')
            .map(line => '    ' + line)  // Add proper indentation
            .join('\n');

        // Get system prompt based on configuration
        if (config.useExistingData === 'yes' && config.restrictToExistingTags === 'no' && config.restrictToExistingCorrespondents === 'no') {
            // Format existing tags
            const existingTagsList = existingTags.join(', ');

            // Format existing correspondents - handle both array of objects and array of strings
            const existingCorrespondentList = correspondentList
                .filter(Boolean)  // Remove any null/undefined entries
                .map(correspondent => {
                    if (typeof correspondent === 'string') return correspondent;
                    return correspondent?.name || '';
                })
                .filter(name => name.length > 0)  // Remove empty strings
                .join(', ');

            // Format existing document types - handle both array of objects and array of strings
            const existingDocumentTypesList = existingDocumentTypes
                .filter(Boolean)  // Remove any null/undefined entries
                .map(docType => {
                    if (typeof docType === 'string') return docType;
                    return docType?.name || '';
                })
                .filter(name => name.length > 0)  // Remove empty strings
                .join(', ');

            systemPrompt = `
            Pre-existing tags: ${existingTagsList}\n\n
            Pre-existing correspondents: ${existingCorrespondentList}\n\n
            Pre-existing document types: ${existingDocumentTypesList}\n\n
            ` + process.env.SYSTEM_PROMPT + '\n\n' + config.mustHavePrompt.replace('%CUSTOMFIELDS%', customFieldsStr);
        } else {
            systemPrompt = process.env.SYSTEM_PROMPT + '\n\n' + config.mustHavePrompt.replace('%CUSTOMFIELDS%', customFieldsStr);
        }

        // Get validated external API data if available
        let validatedExternalApiData = null;
        if (options.externalApiData) {
            try {
                validatedExternalApiData = this._validateAndTruncateExternalApiData(options.externalApiData);
                console.log('[DEBUG] External API data validated and included');
            } catch (error) {
                console.warn('[WARNING] External API data validation failed:', error.message);
                validatedExternalApiData = null;
            }
        }

        // Process placeholder replacements in system prompt
        systemPrompt = RestrictionPromptService.processRestrictionsInPrompt(
            systemPrompt,
            existingTags,
            correspondentList,
            existingDocumentTypes,
            config
        );

        // Include validated external API data if available
        if (validatedExternalApiData) {
            systemPrompt += `\n\nAdditional context from external API:\n${validatedExternalApiData}`;
        }

        if (process.env.USE_PROMPT_TAGS === 'yes') {
            systemPrompt = `
            Take these tags and try to match one or more to the document content.\n\n
            ` + config.specialPromptPreDefinedTags;
        }

        return `${systemPrompt}
        ${JSON.stringify(content)}
        `;
    }

    async analyzePlayground(content, prompt) {
        try {
            // Calculate context window size
            const promptTokenCount = calculateTokens(prompt);
            const numCtx = this._calculateNumCtx(promptTokenCount, 512);

            // Generate playground system prompt (simpler than full analysis)
            const systemPrompt = this._generatePlaygroundSystemPrompt();

            // Call Ollama API
            const response = await this._callOllamaAPI(
                prompt + "\n\n" + JSON.stringify(content),
                systemPrompt,
                numCtx,
                this.playgroundSchema
            );

            // Process response
            const parsedResponse = this._processOllamaResponse(response);

            // Check for missing data
            if (parsedResponse.tags.length === 0 && parsedResponse.correspondent === null) {
                console.warn('No tags or correspondent found in response from Ollama. Review your prompt or switch to OpenAI.');
            }

            // Return results in consistent format
            return {
                document: parsedResponse,
                metrics: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0
                },
                truncated: false
            };
        } catch (error) {
            console.error('Error analyzing document with Ollama:', error);
            return {
                document: this._emptyDocument(),
                metrics: null,
                error: error.message
            };
        }
    }

    _generatePlaygroundSystemPrompt() {
        return `
            You are a document analyzer. Your task is to analyze documents and extract relevant information. You do not ask back questions.
            YOU MUSTNOT: Ask for additional information or clarification, or ask questions about the document, or ask for additional context.
            YOU MUSTNOT: Return a response without the desired JSON format.
            YOU MUST: Analyze the document content and extract the following information into this structured JSON format and only this format!:         {
            "title": "xxxxx",
            "correspondent": "xxxxxxxx",
            "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
            "document_type": "Invoice/Contract/...",
            "document_date": "YYYY-MM-DD",
            "language": "en/de/es/..."
            }
            ALWAYS USE THE INFORMATION TO FILL OUT THE JSON OBJECT. DO NOT ASK BACK QUESTIONS.
        `;
    }

    async generateText(prompt) {
        try {
            // Calculate context window size based on prompt length
            const promptTokenCount = calculateTokens(prompt);
            const numCtx = this._calculateNumCtx(promptTokenCount, 1024);

            // Simple system prompt for text generation
            const systemPrompt = `You are a helpful assistant. Generate a clear, concise, and informative response to the user's question or request.`;

            // Call Ollama API without enforcing a specific response format
            const response = await this.client.post(`${this.apiUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                system: systemPrompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    num_predict: 1024,
                    num_ctx: numCtx
                }
            });

            if (!response.data || !response.data.response) {
                throw new Error('Invalid response from Ollama API');
            }

            return response.data.response;
        } catch (error) {
            console.error('Error generating text with Ollama:', error);
            throw error;
        }
    }

    async checkStatus() {
        try {
            const response = await this.client.get(`${this.apiUrl}/api/ps`);
            if (response.status === 200) {
                const data = response.data;
                let modelName = null;
                if (Array.isArray(data.models) && data.models.length > 0) {
                    modelName = data.models[0].name;
                }
                console.log('Ollama model name:', modelName);
                return { status: 'ok', model: modelName };
            }
        } catch (error) {
            console.error('Error checking Ollama service status:', error);
        }
        return { status: 'error' };
    }

    // Legacy compatibility stubs
    _truncateContent(c) { return truncateToTokenLimit(c, 16000); }
    _calculatePromptTokenCount(text) { return calculateTokens(text); }
    async _logPromptAndResponse(prompt, response) {
        await writePromptToFile(prompt + "\n\n" + JSON.stringify(response, null, 2));
    }
}

module.exports = new OllamaService();
