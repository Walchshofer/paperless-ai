/**
 * VisualSearchClient.js
 *
 * Client for the Visual RAG Sidecar service.
 * Provides visual document retrieval using ColQwen2/ColPali embeddings.
 *
 * Architecture Reference: PROMPT-002 (Visual Retrieval Sidecar)
 *
 * Usage:
 * - Search: Find documents by visual content (tables, charts, layouts)
 * - Index: Add documents to the visual index for retrieval
 * - Health: Check sidecar service status
 */

const axios = require('axios');
const logger = require('../logger');
const config = require('../../config/config');

class VisualSearchClient {
    constructor(options = {}) {
        // Use config value, then env var, then default
        const configUrl = config.visualRagSidecar?.url;
        this.baseUrl = options.baseUrl || process.env.VISUAL_RAG_URL || configUrl || 'http://localhost:8001';
        this.timeout = options.timeout || config.visualRagSidecar?.timeout || 30000;
        this.retries = options.retries || 2;

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Track service availability
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
        const now = Date.now();

        // Use cached result if recent
        if (this._available !== null && (now - this._lastHealthCheck) < this._healthCheckInterval) {
            return this._available;
        }

        try {
            // Use retry helper to tolerate transient startup timing
            const health = await this._retry(() => this.health(), this.retries);
            this._available = health.model_loaded;
            this._lastHealthCheck = now;
            return this._available;
        } catch (error) {
            this._available = false;
            this._lastHealthCheck = now;
            logger.warn('[VisualSearchClient] Sidecar not available:', error.message);

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
        try {
            const response = await this.client.get('/health');
            return response.data;
        } catch (error) {
            throw this._wrapError('Health check failed', error);
        }
    }

    /**
     * Get indexing status from sidecar
     * @returns {Promise<Object>} Status response
     */
    async status() {
        try {
            const response = await this.client.get('/status');
            return response.data;
        } catch (error) {
            throw this._wrapError('Status check failed', error);
        }
    }

    // =========================================================================
    // Search
    // =========================================================================

    /**
     * Search indexed documents visually
     * @param {string} query - Search query text
     * @param {Object} options - Search options
     * @param {number} options.k - Number of results (default: 5)
     * @param {boolean} options.includeBase64 - Include page images (default: false)
     * @returns {Promise<Object>} Search results with doc_id, page_num, score
     */
    async search(query, options = {}) {
        const { k = 5, includeBase64 = false } = options;

        if (!query || typeof query !== 'string') {
            throw new Error('Query must be a non-empty string');
        }

        try {
            logger.debug(`[VisualSearchClient] Searching: "${query}" (k=${k})`);

            const response = await this.client.post('/search', {
                query,
                k,
                include_base64: includeBase64
            });

            const results = response.data;

            logger.info(`[VisualSearchClient] Found ${results.total_results} results for "${query}"`);

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
        } catch (error) {
            throw this._wrapError('Visual search failed', error);
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
            return new Error(`${message}: ${error.response.status} - ${detail}`);
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
    visualSearchClient
};
