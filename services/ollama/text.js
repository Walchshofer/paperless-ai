const config = require('../../config/config');
const {
    calculateTokens,
    truncateToTokenLimit,
    validateDocumentContent,
    writePromptToFile,
    extractJsonFromResponse
} = require('./utils');

module.exports = {
    /**
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
    },

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

            let validatedExternalApiData = null;
            if (options.externalApiData) {
                try {
                    validatedExternalApiData = await this._validateAndTruncateExternalApiData(options.externalApiData);
                    console.log('[DEBUG] External API data validated and included');
                } catch (error) {
                    console.warn('[WARNING] External API data validation failed:', error.message);
                    validatedExternalApiData = null;
                }
            }

            const promptResult = this.promptFactory.buildTextPrompt(
                content,
                {
                    existingTags,
                    existingCorrespondentList,
                    existingDocumentTypesList
                },
                {
                    customPrompt,
                    validatedExternalApiData
                }
            );

            if (customPrompt) {
                console.log('[DEBUG] Ollama Service started with custom prompt');
            }

            const { prompt, systemPrompt } = promptResult;

            // 4. Calculate Context - MUST include both system prompt AND user prompt
            const systemPromptTokens = calculateTokens(systemPrompt);
            const promptTokenCount = calculateTokens(prompt);
            const totalInputTokens = systemPromptTokens + promptTokenCount;
            const expectedResponseTokens = 2048; // Matches num_predict for full JSON with custom_fields
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
    },

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
                    num_predict: 2048, // Increased to allow full JSON response with custom_fields
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
    },

    _processOllamaResponse(responseData) {
        this._logOllamaResponse('Raw Ollama response (full):', responseData);

        if (responseData?.error) {
            console.error('[ERROR] Ollama returned error:', responseData.error);
            throw new Error(`Ollama error: ${responseData.error}`);
        }

        if (responseData.response && typeof responseData.response === 'object') {
            return this._normalize(responseData.response);
        }
        if (typeof responseData?.response === 'string'
            || typeof responseData?.message?.content === 'string'
            || typeof responseData?.thinking === 'string') {
            const rawText = this._extractRawOllamaText(responseData)
                || responseData?.response
                || responseData?.message?.content
                || responseData?.thinking
                || '';
            if (rawText.trim().length === 0) {
                throw new Error('Ollama returned empty response text');
            }
            const extracted = extractJsonFromResponse(rawText);
            if (extracted) return this._normalize(extracted);
            try {
                return this._normalize(JSON.parse(rawText));
            } catch (e) {
                console.error('[ERROR] Failed to parse JSON. Response was:', rawText);
                throw new Error('Could not parse JSON from response');
            }
        }
        throw new Error('Invalid response structure');
    },

    async _repairJsonWithTextModel(rawText) {
        const cleaned = this._sanitizeRepairText(rawText);
        const repairPrompt = this.promptFactory?.buildJsonRepairPrompt
            ? this.promptFactory.buildJsonRepairPrompt(cleaned)
            : `Extract the valid JSON object from the text below.
Rules:
- Ignore any <thinking> blocks or non-JSON content.
- Return ONLY the JSON object (no markdown, no commentary).
- If multiple JSON objects appear, return the most complete one.

TEXT:
${cleaned}`;

        const response = await this.client.post(`${this.apiUrl}/api/generate`, {
            model: this.model,
            prompt: repairPrompt,
            stream: false,
            options: {
                temperature: 0,
                num_predict: 2048,
                num_ctx: 8192
            }
        });

        const rawTextResponse = this._extractRawOllamaText(response.data) || '';
        const extracted = extractJsonFromResponse(rawTextResponse);
        if (extracted) {
            return this._normalize(extracted);
        }

        try {
            return this._normalize(JSON.parse(rawTextResponse));
        } catch (error) {
            console.error('[ERROR] Repair model failed to return JSON:', rawTextResponse);
            throw new Error('Repair model failed to return JSON');
        }
    },

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
};
