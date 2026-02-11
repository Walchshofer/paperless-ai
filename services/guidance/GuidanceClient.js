/**
 * GuidanceClient.js
 *
 * HTTP client for the Python Guidance service.
 * Bridges Node.js pipeline execution with deterministic JSON extraction.
 *
 * The Guidance service provides:
 * - 100% JSON validity via constrained generation
 * - Domain-specific templates (medical, financial, legal, general)
 * - Built-in validation and caching
 * - Prometheus metrics
 *
 * Usage:
 *   const client = new GuidanceClient();
 *   const result = await client.generate('medical_extractor', {
 *     medical_text: 'Patient: Max Mustermann...'
 *   });
 */

const axios = require('axios');
const logger = require('../logger');
const config = require('../../config/config');

// ============================================================================
// CONFIGURATION
// ============================================================================

const GUIDANCE_CONFIG = {
    // Service URL - can be overridden via environment
    baseUrl: process.env.GUIDANCE_SERVICE_URL ||
             config.guidanceService?.url ||
             'http://localhost:8002',

    // Default model for Guidance templates
    defaultModel: process.env.GUIDANCE_MODEL ||
                  config.guidanceService?.model ||
                  'sauerkraut-llama3.1:8b',

    // Timeout for Guidance requests (templates can be slow)
    timeout: parseInt(process.env.GUIDANCE_TIMEOUT || '90000', 10),

    // Enable/disable Guidance integration
    enabled: process.env.GUIDANCE_ENABLED !== 'false' &&
             (config.guidanceService?.enabled ?? true),

    // Retry configuration
    maxRetries: parseInt(process.env.GUIDANCE_MAX_RETRIES || '2', 10),
    retryDelay: parseInt(process.env.GUIDANCE_RETRY_DELAY || '1000', 10),

    // Cache configuration
    useCache: process.env.GUIDANCE_USE_CACHE !== 'false',

    // Streaming support (disabled by default until client implements parsing)
    streamingEnabled: process.env.GUIDANCE_STREAMING_ENABLED === 'true' ||
                      process.env.GUIDANCE_STREAMING_ENABLED === 'yes' ||
                      (config.guidanceService?.streamingEnabled === true)
};

// ============================================================================
// GUIDANCE CLIENT
// ============================================================================

class GuidanceClient {
    constructor(options = {}) {
        this.config = { ...GUIDANCE_CONFIG, ...options };
        this.httpClient = axios.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        this._available = null;  // Cached availability status
        this._availableCheckedAt = 0; // TTL timestamp

        logger.info({
            event: 'guidance_client_initialized',
            baseUrl: this.config.baseUrl,
            enabled: this.config.enabled,
            model: this.config.defaultModel
        });
    }

    /**
     * Check if Guidance service is available
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        if (!this.config.enabled) return false;

        const now = Date.now();
        if (this._available !== null && (now - this._availableCheckedAt) < 60000) {
            return this._available;
        }

        try {
            const response = await this.httpClient.get('/health', {
                timeout: 5000
            });
            this._available = response.data?.status === 'ok';
            this._availableCheckedAt = now;
            return this._available;
        } catch (error) {
            logger.warn({
                event: 'guidance_service_unavailable',
                url: this.config.baseUrl,
                error: error.message
            });
            this._available = false;
            this._availableCheckedAt = now;
            return false;
        }
    }

    /**
     * Reset availability cache (call after service restart)
     */
    resetAvailabilityCache() {
        this._available = null;
    }

    /**
     * Get list of available templates
     * @returns {Promise<string[]>}
     */
    async listTemplates() {
        try {
            const response = await this.httpClient.get('/templates');
            return response.data?.templates || [];
        } catch (error) {
            logger.error({
                event: 'guidance_list_templates_error',
                error: error.message
            });
            return [];
        }
    }

    /**
     * Generate structured output using a Guidance template
     *
     * @param {string} template - Template name (e.g., 'medical_extractor')
     * @param {Object} variables - Template variables
     * @param {Object} options - Optional settings
     * @returns {Promise<Object>} Generated output with validation
     */
    async generate(template, variables, options = {}) {
        const model = options.model || this.config.defaultModel;
        const temperature = options.temperature ?? 0.1;
        const useCache = options.useCache ?? this.config.useCache;
        const requestedStream = options.stream === true;
        let streamEnabled = requestedStream && this.config.streamingEnabled;
        if (requestedStream && !streamEnabled) {
            logger.debug({
                event: 'guidance_streaming_disabled',
                template,
                model
            });
        }

        const startTime = Date.now();
        const variableKeys = Object.keys(variables);

        logger.debug({
            event: 'guidance_generate_start',
            template,
            model,
            variableKeys,
            stream: streamEnabled
        });

        // Check availability
        if (!await this.isAvailable()) {
            throw new GuidanceError(
                'Guidance service is not available',
                'SERVICE_UNAVAILABLE',
                { baseUrl: this.config.baseUrl }
            );
        }

        // Execute with retry logic
        let lastError = null;
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {   
            try {
                const payload = {
                    template,
                    model,
                    variables,
                    temperature,
                    use_cache: useCache
                };
                if (streamEnabled) {
                    payload.stream = true;
                }
                const response = await this.httpClient.post('/generate', payload);

                const result = response.data;

                // Log success with response details (VERBOSE)
                const generatedPreview = result.generated
                    ? JSON.stringify(result.generated).slice(0, 500)
                    : null;

                logger.info({
                    event: 'guidance_generate_success',
                    template,
                    model,
                    source: result.source,  // 'cache' or 'generated'
                    valid: result.validation?.valid,
                    durationMs: Date.now() - startTime,
                    // VERBOSE: Include response preview for debugging
                    generatedPreview,
                    validationErrors: result.validation?.errors?.slice(0, 3),
                    validationWarnings: result.validation?.warnings?.slice(0, 3)
                });

                return {
                    success: true,
                    generated: result.generated,
                    validation: result.validation,
                    source: result.source,
                    metadata: {
                        template,
                        model,
                        durationMs: Date.now() - startTime
                    }
                };

            } catch (error) {
                lastError = error;

                if (streamEnabled && this._isStreamingUnsupported(error)) {
                    logger.warn({
                        event: 'guidance_streaming_unsupported',
                        template,
                        model,
                        error: error.message
                    });
                    streamEnabled = false;
                    continue;
                }

                const errorDetails = this._extractErrorDetails(error);
                const httpDetails = this._extractHttpDetails(error);

                logger.warn({
                    event: 'guidance_generate_retry',
                    template,
                    model,
                    attempt,
                    maxRetries: this.config.maxRetries,
                    durationMs: Date.now() - startTime,
                    error: errorDetails.message,
                    code: errorDetails.code,
                    status: httpDetails.status,
                    response: httpDetails.response
                });

                if (attempt < this.config.maxRetries) {
                    await this._delay(this.config.retryDelay * attempt);
                }
            }
        }

        // All retries failed
        const errorDetails = this._extractErrorDetails(lastError);
        const httpDetails = this._extractHttpDetails(lastError);

        logger.error({
            event: 'guidance_generate_failed',
            template,
            model,
            durationMs: Date.now() - startTime,
            error: errorDetails.message,
            code: errorDetails.code,
            status: httpDetails.status,
            response: httpDetails.response,
            stream: streamEnabled,
            baseUrl: this.config.baseUrl
        });

        throw new GuidanceError(
            errorDetails.message,
            errorDetails.code,
            { template, model, originalError: lastError }
        );
    }

    /**
     * Generate with fallback to raw Ollama if Guidance fails
     *
     * @param {string} template - Guidance template name
     * @param {Object} variables - Template variables
     * @param {Function} fallbackFn - Fallback function returning Promise<Object>
     * @param {Object} options - Optional settings
     * @returns {Promise<Object>}
     */
    async generateWithFallback(template, variables, fallbackFn, options = {}) {
        try {
            return await this.generate(template, variables, options);
        } catch (error) {
            const errorDetails = this._extractErrorDetails(error);
            const httpDetails = this._extractHttpDetails(error);

            logger.warn({
                event: 'guidance_fallback_triggered',
                template,
                model: options.model || this.config.defaultModel,
                error: errorDetails.message,
                code: errorDetails.code,
                status: httpDetails.status,
                response: httpDetails.response
            });

            if (typeof fallbackFn === 'function') {
                const fallbackResult = await fallbackFn();
                return {
                    success: true,
                    generated: fallbackResult,
                    validation: { valid: true, source: 'fallback' },
                    source: 'fallback',
                    metadata: {
                        template,
                        fallbackReason: error.message
                    }
                };
            }

            throw error;
        }
    }

    /**
     * Batch generate multiple templates
     *
     * @param {Array<{template: string, variables: Object}>} requests
     * @param {Object} options
     * @returns {Promise<Array<Object>>}
     */
    async batchGenerate(requests, options = {}) {
        const results = await Promise.allSettled(
            requests.map(req =>
                this.generate(req.template, req.variables, {
                    ...options,
                    ...req.options
                })
            )
        );

        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            return {
                success: false,
                error: result.reason.message,
                template: requests[index].template
            };
        });
    }

    /**
     * Helper: Check server templates and warn if expected templates are missing.
     * Note: The Guidance service manages templates server-side; this method
     * provides a convenience for operators to verify registration.
     *
     * @param {Object} templates - Map of templateName => metadata
     */
    async registerTemplates(templates = {}) {
        try {
            const available = await this.listTemplates();
            for (const name of Object.keys(templates)) {
                if (!available.includes(name)) {
                    logger.warn({ event: 'guidance_template_missing', template: name });
                } else {
                    logger.info({ event: 'guidance_template_registered', template: name });
                }
            }
            return true;
        } catch (error) {
            logger.warn({ event: 'guidance_register_templates_failed', error: error.message });
            return false;
        }
    }

    /**
     * Check a single template registration status
     * @param {string} name
     * @returns {Promise<boolean>}
     */
    async registerTemplate(name, _template) {
        const available = await this.listTemplates();
        if (!available.includes(name)) {
            logger.warn({ event: 'guidance_template_missing', template: name });
            return false;
        }
        logger.info({ event: 'guidance_template_present', template: name });
        return true;
    }

    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================

    _isStreamingUnsupported(error) {
        if (!error || !error.response) return false;
        const status = error.response.status;
        if (![400, 404, 405].includes(status)) return false;
        const message = String(error.response.data?.error || error.message || '').toLowerCase();
        return message.includes('stream') || message.includes('streaming') || message.includes('unknown');
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _summarizeResponseData(data) {
        if (!data) return undefined;

        if (typeof data === 'string') {
            return data.length > 500 ? `${data.slice(0, 500)}...` : data;
        }

        if (typeof data === 'object') {
            const summary = {};
            const keys = ['error', 'detail', 'message', 'code', 'status'];
            keys.forEach(key => {
                if (data[key] !== undefined) {
                    summary[key] = data[key];
                }
            });
            if (Object.keys(summary).length > 0) {
                return summary;
            }
            try {
                return JSON.stringify(data).slice(0, 500);
            } catch (error) {
                return '[unserializable response]';
            }
        }

        return String(data).slice(0, 500);
    }

    _extractHttpDetails(error) {
        if (!error || !error.response) {
            return {};
        }

        return {
            status: error.response.status,
            statusText: error.response.statusText,
            response: this._summarizeResponseData(error.response.data)
        };
    }

    _extractErrorDetails(error) {
        if (error.response) {
            // HTTP error from Guidance service
            const data = error.response.data || {};
            return {
                message: data.error || error.message,
                code: `HTTP_${error.response.status}`
            };
        }

        if (error.code === 'ECONNREFUSED') {
            return {
                message: 'Guidance service connection refused',
                code: 'CONNECTION_REFUSED'
            };
        }

        if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
            return {
                message: 'Guidance service request timed out',
                code: 'TIMEOUT'
            };
        }

        return {
            message: error.message || 'Unknown Guidance error',
            code: 'UNKNOWN'
        };
    }
}

// ============================================================================
// ERROR CLASS
// ============================================================================

class GuidanceError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'GuidanceError';
        this.code = code;
        this.details = details;
    }
}

// ============================================================================
// TEMPLATE MAPPING
// ============================================================================

/**
 * Maps pipeline stage guidance templates to prompt IDs for fallback
 */
const TEMPLATE_TO_PROMPT_FALLBACK = {
    // Medical
    'medical_classifier': 'MED_RADIOLOGY_V1',
    'medical_extractor': 'MED_DOCTOR_V1',
    'medical_integrator': 'MED_INTEGRATOR_V1',
    'medical_integrator_v2': 'MED_INTEGRATOR_V1',

    // Financial
    'financial_extractor': 'FIN_EXTRACT_V1',
    'financial_reasoner': 'FIN_REASONER_V1',
    'vat_expert_analyzer': 'FIN_VAT_EXPERT_V1',
    'financial_extractor_v2': 'FIN_EXTRACT_V1',
    'financial_reasoner_v2': 'FIN_REASONER_V1',

    // Legal
    'legal_classifier': 'LEGAL_ORCHESTRATOR_V1',
    'legal_extractor': 'LEGAL_EXTRACTOR_V1',
    'legal_validator': 'LEGAL_EXTRACTOR_V1',
    'legal_extractor_v2': 'LEGAL_EXTRACTOR_V1',

    // General
    'general_classifier': 'GEN_FALLBACK_V1',
    'general_extractor': 'GEN_FALLBACK_V1',
    'general_extractor_v2': 'GEN_FALLBACK_V1',
    'cross_pipeline_router': 'SYS_ROUTER_V1',

    // Visual query generation
    'visual_query_generator_de': 'VISUAL_QUERY_GENERATOR_V1',
    'financial_visual_query_generator_de': 'VISUAL_QUERY_GENERATOR_V1',
    'medical_visual_query_generator_de': 'VISUAL_QUERY_GENERATOR_V1',
    'legal_visual_query_generator_de': 'VISUAL_QUERY_GENERATOR_V1',

    // Normalization
    'normalization_geometry': 'SYS_ROUTER_V1',

    // System tools
    'prompt_validator': 'GEN_FALLBACK_V1'
};

/**
 * Get fallback prompt ID for a Guidance template
 */
function getFallbackPromptId(guidanceTemplate) {
    return TEMPLATE_TO_PROMPT_FALLBACK[guidanceTemplate] || null;
} 

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

const guidanceClient = new GuidanceClient();

module.exports = {
    GuidanceClient,
    GuidanceError,
    guidanceClient,
    getFallbackPromptId,
    GUIDANCE_CONFIG
};
