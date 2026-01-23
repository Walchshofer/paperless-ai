/**
 * VisualSearchClient.js
 *
 * Client for the Visual RAG Sidecar service.
 * Provides visual document retrieval using ColQwen3-4B-AWQ embeddings.
 *
 * Architecture Reference: PROMPT-002, ticket:006.1 (Alpha-9 Protocol)
 *
 * Usage:
 * - Search: Find documents by visual content (tables, charts, layouts)
 * - searchImageAlpha9: Alpha-9 image search with collection routing
 * - Index: Add documents to the visual index for retrieval
 * - Health: Check sidecar service status
 *
 * Alpha-9 Protocol Features:
 * - Collection routing (visual_pages, visual_overlays)
 * - Expert Filtering (doc_id, tag_ids, correspondent_id)
 * - 503 Initializing state handling
 * - 5-second strict timeout with AbortController
 */

// Error types for 503 handling (ticket:006.1)
const ErrorTypes = {
    SIDECAR_INITIALIZING: 'SIDECAR_INITIALIZING',
    TIMEOUT: 'TIMEOUT',
    CIRCUIT_OPEN: 'CIRCUIT_OPEN',
    NETWORK_ERROR: 'NETWORK_ERROR'
};

// Valid collections for Alpha-9 protocol
const VALID_COLLECTIONS = ['visual_pages', 'visual_overlays'];

const axios = require('axios');
const logger = require('../logger');
const { metricsCollector } = require('../metrics/PrometheusMetrics');
const { CircuitBreaker, CircuitState } = require('../experts/CircuitBreaker');
const config = require('../../config/config');

// Re-export CircuitState as CircuitBreakerStates for API consumers (ticket:014.1)
const CircuitBreakerStates = CircuitState;

class VisualSearchClient {
    constructor(options = {}) {
        // Use config value, then env var, then default
        const configUrl = config.visualRagSidecar?.url;
        this.baseUrl = options.baseUrl || process.env.VISUAL_RAG_URL || configUrl || 'http://localhost:8001';
        this.timeout = options.timeout || config.visualRagSidecar?.timeout || 30000;
        this.retries = options.retries || 2;
        this.metricsCollector = options.metricsCollector || metricsCollector || null;

        // Concurrency + query timeout settings
        this._maxConcurrent = options.maxConcurrent || config.visualRagSidecar?.maxConcurrent || 5;
        this._active = 0;
        this._queue = [];
        // Use a more tolerant default for query timeout to avoid circuit breaker opens during model warm-up
        this.queryTimeout = options.queryTimeout || config.visualRagSidecar?.queryTimeout || 2000;

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Initialize Circuit Breaker (use short query-level timeout by default)
        // Support custom options from constructor for testing (ticket:014.1)
        this.circuitBreaker = new CircuitBreaker('visual-rag', {
            failureThreshold: options.failureThreshold || config.visualRagSidecar?.failureThreshold || 3,
            cooldownPeriod: options.cooldownMs || config.visualRagSidecar?.cooldownPeriod || 30000,
            timeout: this.queryTimeout,
            hardTimeout: Math.max(1000, this.queryTimeout * 2)
        }, this.metricsCollector);

        // Track service availability (legacy check)
        this._available = null;
        this._lastHealthCheck = 0;
        this._healthCheckInterval = 60000; // 1 minute
    }

    // =========================================================================
    // Health & Status
    // =========================================================================

    /**
     * Check if the sidecar service is available
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        // First check Circuit Breaker state
        if (this.circuitBreaker.isOpen()) {
            logger.warn('[VisualSearchClient] Circuit breaker is OPEN, sidecar considered unavailable');
            return false;
        }

        const now = Date.now();

        // Use cached result if recent
        if (this._available !== null && (now - this._lastHealthCheck) < this._healthCheckInterval) {
            return this._available;
        }

        try {
            // Use retry helper to tolerate transient startup timing
            // Health checks are more tolerant: use a longer timeout than query timeout
            const health = await this._retry(() => this.health({ timeout: Math.max(3000, this.timeout) }), this.retries);
            this._available = health.model_loaded;
            this._lastHealthCheck = now;
            if (this.metricsCollector?.recordSidecarAvailability) {
                this.metricsCollector.recordSidecarAvailability('visual-rag', this._available);
            }
            return this._available;
        } catch (error) {
            this._available = false;
            this._lastHealthCheck = now;
            logger.warn('[VisualSearchClient] Sidecar not available:', error.message);
            if (this.metricsCollector?.recordSidecarAvailability) {
                this.metricsCollector.recordSidecarAvailability('visual-rag', false);
            }

            // Try a localhost fallback if the service host is not localhost
            try {
                const urlHostPattern = /^https?:\/\/([^:/]+)(:\d+)?/i;
                const m = (this.baseUrl || '').match(urlHostPattern);
                if (m) {
                    const host = m[1];
                    if (host !== 'localhost' && host !== '127.0.0.1') {
                        const fallbackUrl = (this.baseUrl || '').replace(host, 'localhost');
                        logger.debug(`[VisualSearchClient] Trying fallback health check at ${fallbackUrl}`);
                        const resp = await axios.get(`${fallbackUrl.replace(/\/$/, '')}/health`, { timeout: Math.max(3000, this.timeout) });
                        if (resp && resp.data && resp.data.model_loaded !== undefined) {
                            logger.info('[VisualSearchClient] Sidecar reachable via localhost fallback');
                            // Update client to use the localhost fallback so subsequent requests succeed
                            this.baseUrl = fallbackUrl.replace(/\/$/, '');
                            this.client = axios.create({
                                baseURL: this.baseUrl,
                                timeout: this.timeout,
                                headers: { 'Content-Type': 'application/json' }
                            });
                            this._available = !!resp.data.model_loaded;
                            this._lastHealthCheck = Date.now();
                            return this._available;
                        }
                    }
                }
            } catch (fallbackErr) {
                logger.debug('[VisualSearchClient] Localhost fallback failed:', fallbackErr.message);
            }

            return false;
        }
    }

    /**
     * Get health status from sidecar
     * @returns {Promise<Object>} Health response
     */
    async health() {
        const result = await this.circuitBreaker.execute(async () => {
            try {
                const response = await this.client.get('/health');
                return response.data;
            } catch (error) {
                throw this._wrapError('Health check failed', error);
            }
        });

        if (result.fallback || !result.success) {
            throw result.error || new Error('Health check failed');
        }
        return result.data;
    }

    /**
     * Get indexing status from sidecar
     * @returns {Promise<Object>} Status response
     */
    async status() {
        const result = await this.circuitBreaker.execute(async () => {
            try {
                const response = await this.client.get('/status');
                return response.data;
            } catch (error) {
                throw this._wrapError('Status check failed', error);
            }
        });

        if (result.fallback || !result.success) {
            throw result.error || new Error('Status check failed');
        }
        return result.data;
    }

    // =========================================================================
    // Search
    // =========================================================================

    /**
     * Search indexed documents visually using a query image (find similar)
     * @param {string} base64Image - Base64 encoded query image
     * @param {Object} options - Search options
     * @param {number} options.k - Number of results (default: 5)
     * @param {boolean} options.includeBase64 - Include page images (default: false)
     * @param {string} options.requestId - Request ID for tracing
     * @returns {Promise<Object>} Search results
     */
    // Simple in-process concurrency limiter (semaphore)
    _acquire() {
        if (this._active < this._maxConcurrent) {
            this._active++;
            return Promise.resolve();
        }
        return new Promise(resolve => {
            this._queue.push(resolve);
        }).then(() => { this._active++; });
    }

    _release() {
        this._active = Math.max(0, this._active - 1);
        if (this._queue.length > 0) {
            const next = this._queue.shift();
            if (typeof next === 'function') next();
        }
    }

    async searchImage(base64Image, options = {}) {
        const { k = 5, includeBase64 = false, requestId } = options;

        if (!base64Image || typeof base64Image !== 'string') {
            throw new Error('base64Image must be a non-empty string');
        }

        const headers = requestId ? { 'X-Request-Id': requestId } : {};

        await this._acquire();
        try {
            const result = await this.circuitBreaker.execute(async () => {
                const startTime = Date.now();
                logger.debug(`[VisualSearchClient] Searching via image (k=${k})`, { requestId });

                const response = await this.client.post('/search', {
                    query_image: base64Image,
                    k,
                    include_base64: includeBase64
                }, { headers });

                const results = response.data;
                const durationMs = Date.now() - startTime;
                
                if (this.metricsCollector?.observeEmbeddingQueryLatency) {
                    this.metricsCollector.observeEmbeddingQueryLatency(
                        'image-to-image',
                        durationMs
                    );
                }
                if (this.metricsCollector?.recordSidecarAvailability) {
                    this.metricsCollector.recordSidecarAvailability('visual-rag', true);
                }

                logger.info(`[VisualSearchClient] Found ${results.total_results} results for image query`, { requestId });

                return {
                    query: results.query, // "[IMAGE]"
                    results: results.results.map(r => ({
                        docId: r.doc_id,
                        pageNum: r.page_num,
                        score: r.score,
                        filePath: r.file_path,
                        metadata: r.metadata,
                        base64: r.base64
                    })),
                    totalResults: results.total_results
                };
            }, { timeout: options.timeout || this.queryTimeout, retries: options.retries || this.retries });

            if (result.fallback) {
                throw result.error || new Error('Circuit breaker fallback triggered');
            }
            
            return result.data;

        } catch (error) {
            // Error handling is partly done by Circuit Breaker, but we re-throw for API response
            if (this.metricsCollector?.recordSidecarAvailability && !this.circuitBreaker.isOpen()) {
                this.metricsCollector.recordSidecarAvailability('visual-rag', false);
            }
            throw this._wrapError('Visual image search failed', error);
        } finally {
            this._release();
        }
    }

    /**
     * Alpha-9 Protocol: Image search with collection routing (ticket:006.1)
     *
     * @param {string} base64Image - Base64 encoded query image
     * @param {string} collection - Target collection (visual_pages|visual_overlays)
     * @param {Object} filters - Expert Filtering options
     * @param {number} filters.doc_id - Filter by document ID
     * @param {number[]} filters.tag_ids - Filter by tag IDs
     * @param {number} filters.correspondent_id - Filter by correspondent
     * @param {number} limit - Number of results (default: 5)
     * @returns {Promise<Object>} Search results with MaxSim scores
     * @throws {Error} With type SIDECAR_INITIALIZING for 503 response
     */
    async searchImageAlpha9(base64Image, collection = 'visual_pages', filters = {}, limit = 5) {
        // Validate collection
        if (!VALID_COLLECTIONS.includes(collection)) {
            throw new Error(`Invalid collection: ${collection}. Valid: ${VALID_COLLECTIONS.join(', ')}`);
        }

        if (!base64Image || typeof base64Image !== 'string') {
            throw new Error('base64Image must be a non-empty string');
        }

        // Check circuit breaker state first (ticket:014.1)
        if (this.circuitBreaker.isOpen()) {
            // Check if cooldown elapsed - if so, transition to HALF_OPEN and allow a test request
            const timeSinceFailure = Date.now() - (this.circuitBreaker.lastFailureTime || 0);
            const cooldownPeriod = this.circuitBreaker.config.cooldownPeriod;

            if (timeSinceFailure < cooldownPeriod) {
                // Circuit is OPEN, fail fast
                logger.warn('[VisualSearchClient] Circuit breaker OPEN, failing fast');
                const err = new Error('Visual search temporarily unavailable (circuit open)');
                err.type = ErrorTypes.CIRCUIT_OPEN;
                throw err;
            }
            // Cooldown elapsed, transition to HALF_OPEN and allow test request
            this.circuitBreaker.state = CircuitState.HALF_OPEN;
            logger.info('[VisualSearchClient] Circuit breaker transitioning to HALF_OPEN for test request');
        }

        // Alpha-9 strict timeout: 5000ms (ticket:006.1)
        const ALPHA9_TIMEOUT = 5000;

        await this._acquire();
        const startTime = Date.now();

        try {
            // Create AbortController for strict timeout (ticket:006.1)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), ALPHA9_TIMEOUT);

            logger.debug(`[VisualSearchClient] Alpha-9 search: collection=${collection}, limit=${limit}`);

            const response = await this.client.post('/search', {
                query_image: base64Image,
                collection_name: collection,
                filters: Object.keys(filters).length > 0 ? filters : undefined,
                k: limit
            }, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const data = response.data;
            const durationMs = Date.now() - startTime;

            if (this.metricsCollector?.observeEmbeddingQueryLatency) {
                this.metricsCollector.observeEmbeddingQueryLatency('alpha9-image', durationMs);
            }

            logger.info(`[VisualSearchClient] Alpha-9 search completed in ${durationMs}ms, ${data.results?.length || 0} results`);

            // Record success - reset circuit breaker state (ticket:014.1)
            this.circuitBreaker.failureCount = 0;
            if (this.circuitBreaker.state === CircuitState.HALF_OPEN) {
                this.circuitBreaker.state = CircuitState.CLOSED;
                logger.info('[VisualSearchClient] Circuit breaker recovered to CLOSED');
            }

            return {
                results: (data.results || []).map(r => ({
                    docId: r.doc_id,
                    score: r.score,
                    pageNum: r.page_num,
                    thumbnailUrl: r.thumbnail_url
                })),
                scoreType: data.score_type || 'maxsim',
                collectionUsed: data.collection_used || collection,
                executionTimeMs: data.execution_time_ms || durationMs,
                queryType: data.query_type || 'image'
            };

        } catch (error) {
            const durationMs = Date.now() - startTime;

            // Handle 503 Initializing response (ticket:006.1)
            // NOTE: 503 Initializing does NOT trip the circuit breaker (ticket:014.1)
            if (error.response?.status === 503) {
                const detail = error.response.data?.detail || 'Initializing';
                logger.warn(`[VisualSearchClient] Sidecar 503: ${detail}`);

                const err = new Error(`Sidecar initializing: ${detail}`);
                err.type = ErrorTypes.SIDECAR_INITIALIZING;
                err.status = 503;
                err.detail = detail;
                throw err;
            }

            // Handle timeout (AbortController)
            // Note: axios uses ERR_CANCELED code when aborted via AbortController
            if (error.name === 'AbortError' || error.code === 'ECONNABORTED' ||
                error.code === 'ERR_CANCELED' || error.name === 'CanceledError') {
                logger.error(`[VisualSearchClient] Alpha-9 timeout after ${durationMs}ms`);

                // Timeouts count as failures for circuit breaker
                this._recordAlpha9Failure();

                const err = new Error(`Request timeout (${ALPHA9_TIMEOUT}ms exceeded)`);
                err.type = ErrorTypes.TIMEOUT;
                err.durationMs = durationMs;
                throw err;
            }

            // Record failure for circuit breaker (ticket:014.1)
            this._recordAlpha9Failure();

            // Handle other errors
            if (this.metricsCollector?.recordSidecarAvailability) {
                this.metricsCollector.recordSidecarAvailability('visual-rag', false);
            }

            throw this._wrapError('Alpha-9 image search failed', error);
        } finally {
            this._release();
        }
    }

    /**
     * Record a failure for Alpha-9 circuit breaker (ticket:014.1)
     * @private
     */
    _recordAlpha9Failure() {
        this.circuitBreaker.failureCount++;
        this.circuitBreaker.lastFailureTime = Date.now();

        const threshold = this.circuitBreaker.config.failureThreshold;

        // Transition to OPEN if threshold exceeded
        if (this.circuitBreaker.state === CircuitState.CLOSED &&
            this.circuitBreaker.failureCount >= threshold) {
            this.circuitBreaker.state = CircuitState.OPEN;
            logger.warn(`[VisualSearchClient] Circuit breaker OPENED after ${this.circuitBreaker.failureCount} failures`);
        } else if (this.circuitBreaker.state === CircuitState.HALF_OPEN) {
            // Failed during recovery test, go back to OPEN
            this.circuitBreaker.state = CircuitState.OPEN;
            logger.warn('[VisualSearchClient] Circuit breaker returned to OPEN (HALF_OPEN test failed)');
        }
    }

    /**
     * Search indexed documents visually
     * @param {string} query - Search query text
     * @param {Object} options - Search options
     * @param {number} options.k - Number of results (default: 5)
     * @param {boolean} options.includeBase64 - Include page images (default: false)
     * @param {string} options.requestId - Request ID for tracing
     * @returns {Promise<Object>} Search results with doc_id, page_num, score
     */
    async search(query, options = {}) {
        const { k = 5, includeBase64 = false, queryType, requestId } = options;

        if (!query || typeof query !== 'string') {
            throw new Error('Query must be a non-empty string');
        }

        const headers = requestId ? { 'X-Request-Id': requestId } : {};

        await this._acquire();
        try {
            const result = await this.circuitBreaker.execute(async () => {
                const startTime = Date.now();
                logger.debug(`[VisualSearchClient] Searching: "${query}" (k=${k})`, { requestId });

                const response = await this.client.post('/search', {
                    query,
                    k,
                    include_base64: includeBase64
                }, { headers });

                const results = response.data;
                const durationMs = Date.now() - startTime;
                if (this.metricsCollector?.observeEmbeddingQueryLatency) {
                    this.metricsCollector.observeEmbeddingQueryLatency(
                        queryType || 'unknown',
                        durationMs
                    );
                }
                if (this.metricsCollector?.recordSidecarAvailability) {
                    this.metricsCollector.recordSidecarAvailability('visual-rag', true);
                }

                logger.info(`[VisualSearchClient] Found ${results.total_results} results for "${query}"`, { requestId });

                return {
                    query: results.query,
                    results: results.results.map(r => ({
                        docId: r.doc_id,
                        pageNum: r.page_num,
                        score: r.score,
                        filePath: r.file_path,
                        metadata: r.metadata,
                        base64: r.base64
                    })),
                    totalResults: results.total_results
                };
            }, { timeout: options.timeout || this.queryTimeout, retries: options.retries || this.retries });

            if (result.fallback) {
                throw result.error || new Error('Circuit breaker fallback triggered');
            }

            return result.data;

        } catch (error) {
            if (this.metricsCollector?.recordSidecarAvailability && !this.circuitBreaker.isOpen()) {
                this.metricsCollector.recordSidecarAvailability('visual-rag', false);
            }
            throw this._wrapError('Visual search failed', error);
        } finally {
            this._release();
        }
    }

    /**
     * Search with automatic fallback if sidecar unavailable
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Object|null>} Results or null if unavailable
     */
    async searchWithFallback(query, options = {}) {
        const available = await this.isAvailable();

        if (!available) {
            logger.debug('[VisualSearchClient] Sidecar unavailable, skipping visual search');
            return null;
        }

        try {
            return await this.search(query, options);
        } catch (error) {
            logger.warn('[VisualSearchClient] Search failed, returning null:', error.message);
            return null;
        }
    }

    // =========================================================================
    // Indexing
    // =========================================================================

    /**
     * Index a single PDF document
     * @param {number} docId - Paperless document ID
     * @param {string} pdfPath - Path to PDF (relative to /media/paperless)
     * @param {Object} metadata - Additional metadata to store
     * @returns {Promise<Object>} Indexing status
     */
    async indexDocument(docId, pdfPath, metadata = {}) {
        // Allow indexing by PDF path OR by array of base64 images
        const useImages = Array.isArray(arguments[3]) && arguments[3].length > 0;
        const base64Images = useImages ? arguments[3] : null;

        if (!useImages && (!pdfPath || typeof pdfPath !== 'string')) {
            throw new Error('PDF path must be a non-empty string when images are not provided');
        }

        try {
            if (useImages) {
                logger.info(`[VisualSearchClient] Indexing document ${docId} via ${base64Images.length} image(s)`);

                const response = await this.client.post('/index/document', {
                    doc_id: docId,
                    images: base64Images,
                    metadata
                });

                logger.info(`[VisualSearchClient] Indexing (images) started for document ${docId}`);

                return {
                    status: response.data.status,
                    document: response.data.document,
                    docId
                };
            }

            logger.info(`[VisualSearchClient] Indexing document ${docId}: ${pdfPath}`);

            const response = await this.client.post('/index/document', {
                doc_id: docId,
                pdf_path: pdfPath,
                metadata
            });

            logger.info(`[VisualSearchClient] Indexing started for document ${docId}`);

            return {
                status: response.data.status,
                document: response.data.document,
                docId
            };
        } catch (error) {
            throw this._wrapError(`Failed to index document ${docId}`, error);
        }
    }

    /**
     * Index all PDFs in a directory
     * @param {string} directory - Directory path (relative to /media/paperless)
     * @param {boolean} recursive - Index subdirectories
     * @returns {Promise<Object>} Indexing status with PDF count
     */
    async indexDirectory(directory, recursive = true) {
        try {
            logger.info(`[VisualSearchClient] Indexing directory: ${directory} (recursive=${recursive})`);

            const response = await this.client.post('/index/directory', {
                directory,
                recursive
            });

            logger.info(`[VisualSearchClient] Batch indexing started: ${response.data.pdf_count} PDFs`);

            return {
                status: response.data.status,
                directory: response.data.directory,
                pdfCount: response.data.pdf_count
            };
        } catch (error) {
            throw this._wrapError(`Failed to index directory ${directory}`, error);
        }
    }

    /**
     * Clear the visual index
     * @returns {Promise<Object>} Clear status
     */
    async clearIndex() {
        try {
            logger.warn('[VisualSearchClient] Clearing visual index');

            const response = await this.client.delete('/index');

            logger.info('[VisualSearchClient] Visual index cleared');

            return response.data;
        } catch (error) {
            throw this._wrapError('Failed to clear index', error);
        }
    }

    // =========================================================================
    // Circuit Breaker State (ticket:014.1)
    // =========================================================================

    /**
     * Get current circuit breaker state
     * @returns {string} Current state (CLOSED, OPEN, HALF_OPEN)
     */
    getCircuitState() {
        return this.circuitBreaker.state;
    }

    /**
     * Get current failure count
     * @returns {number} Number of consecutive failures
     */
    getFailureCount() {
        return this.circuitBreaker.failureCount;
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Wrap axios errors with context
     * @private
     */
    _wrapError(message, error) {
        if (error.response) {
            // Server responded with error
            const detail = error.response.data?.detail || error.response.statusText;
            const wrapped = new Error(`${message}: ${error.response.status} - ${detail}`);
            wrapped.status = error.response.status;
            wrapped.detail = detail;
            if (wrapped.status === 503) {
                wrapped.type = ErrorTypes.SIDECAR_INITIALIZING;
            }
            return wrapped;
        } else if (error.request) {
            // No response received
            return new Error(`${message}: No response from sidecar (${this.baseUrl})`);
        } else {
            // Request setup error
            return new Error(`${message}: ${error.message}`);
        }
    }

    /**
     * Retry a function with exponential backoff
     * @private
     */
    async _retry(fn, maxRetries = this.retries) {
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    logger.debug(`[VisualSearchClient] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }
}

// Export singleton instance and class
const visualSearchClient = new VisualSearchClient();

module.exports = {
    VisualSearchClient,
    visualSearchClient,
    // Alpha-9 Protocol exports (ticket:006.1)
    ErrorTypes,
    VALID_COLLECTIONS,
    // Circuit Breaker exports (ticket:014.1)
    CircuitBreakerStates
};
