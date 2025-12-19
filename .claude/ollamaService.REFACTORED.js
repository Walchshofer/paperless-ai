const axios = require('axios');
const config = require('../config/config');
const fs = require('fs').promises;
const path = require('path');
const paperlessService = require('./paperlessService');
const os = require('os');
const RestrictionPromptService = require('./restrictionPromptService');

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

    async analyzeDocument(content, existingTags = [], existingCorrespondentList = [], existingDocumentTypesList = [], id, customPrompt = null, options = {}) {
        const startTime = Date.now();
        try {
            console.log(`[DEBUG] Starting document analysis for ID: ${id}`);

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
                customFieldsObj.custom_fields.forEach((field, index) => {
                    customFieldsTemplate[index] = {
                        field_name: field.value,
                        value: "Fill in the value based on your analysis"
                    };
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

            // 4. Calculate Context
            const promptTokenCount = calculateTokens(prompt);
            const expectedResponseTokens = 512;
            const numCtx = this._calculateNumCtx(promptTokenCount, expectedResponseTokens);

            console.log(`[DEBUG] Tokens: ${promptTokenCount}, Context: ${numCtx}, Model: ${this.model}`);
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
                document: { tags: [], correspondent: null },
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
            const res = await this.client.post(`${this.apiUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                system: systemPrompt,
                stream: false,
                format: schema,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    repeat_penalty: 1.1,
                    top_k: 7,
                    num_predict: 256,
                    num_ctx: numCtx
                }
            });

            if (res.status !== 200) throw new Error(`Ollama Status: ${res.status}`);
            if (!res.data || !res.data.response) throw new Error('Empty response from Ollama');

            return res.data;
        } catch (error) {
            if (error.code === 'ECONNABORTED') throw new Error(`Timeout (${this.timeout}ms). Model loading?`);
            throw error;
        }
    }

    _processOllamaResponse(responseData) {
        if (responseData.response && typeof responseData.response === 'object') {
            return this._normalize(responseData.response);
        }
        if (typeof responseData.response === 'string') {
            const extracted = extractJsonFromResponse(responseData.response);
            if (extracted) return this._normalize(extracted);
            try {
                return this._normalize(JSON.parse(responseData.response));
            } catch(e) {
                 throw new Error('Could not parse JSON from response');
            }
        }
        throw new Error('Invalid response structure');
    }

    _normalize(data) {
        return {
            tags: Array.isArray(data.tags) ? data.tags : [],
            correspondent: data.correspondent || null,
            title: data.title || null,
            document_date: data.document_date || null,
            document_type: data.document_type || null,
            language: data.language || null,
            custom_fields: data.custom_fields || null
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

    _generateCustomFieldsTemplate() {
        try {
            const obj = JSON.parse(process.env.CUSTOM_FIELDS || '{"custom_fields":[]}');
            const tpl = {};
            obj.custom_fields.forEach((f, i) => tpl[i] = { field_name: f.value, value: "Fill in the value based on your analysis" });
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
            Do not change the value of field_name, only fill out the values. If the field is about money only add the number without currency and always use a . for decimal places.
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

        customFieldsObj.custom_fields.forEach((field, index) => {
            customFieldsTemplate[index] = {
                field_name: field.value,
                value: "Fill in the value based on your analysis"
            };
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
                document: { tags: [], correspondent: null },
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
