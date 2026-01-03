/**
 * HybridSearchService.js
 *
 * Combines visual search (ColQwen2 sidecar) with text-based RAG search
 * using Reciprocal Rank Fusion (RRF) for improved document retrieval.
 *
 * Architecture Reference: PROMPT-004 (Hybrid Search Service)
 *
 * RRF Formula: score(d) = Σ 1 / (k + rank(d)) for each result list
 * Default k = 60 (standard RRF constant)
 *
 * Usage:
 *   const { hybridSearchService } = require('./services/visual-rag');
 *   const results = await hybridSearchService.search('invoice total', { k: 10 });
 */

const logger = require('../logger');
const { visualSearchClient } = require('./VisualSearchClient');
const ragService = require('../ragService');

class HybridSearchService {
    constructor(options = {}) {
        this.visualSearchClient = options.visualSearchClient || visualSearchClient;
        this.ragService = options.ragService || ragService;

        // RRF parameters
        this.rrfK = options.rrfK || 60;  // Standard RRF constant

        // Weight for visual vs text (0 = text only, 1 = visual only, 0.5 = equal)
        this.alpha = options.alpha ?? 0.5;

        // Caching
        this._visualAvailable = false;
        this._textAvailable = false;
        this._initializationError = null;
        this._lastCheck = 0;
        this._checkInterval = 60000; // 1 minute

        // Perform async initialization without blocking constructor
        this._initializeAsync().catch(err => {
            this._initializationError = err;
            logger.warn('[HybridSearchService] Initialization failed, service will operate in degraded mode', {
                error: err.message
            });
        });
    }

    async _initializeAsync() {
        // Check visual search availability
        try {
            this._visualAvailable = await this.visualSearchClient.isAvailable();
        } catch (error) {
            logger.debug('[HybridSearchService] Visual search check failed:', error.message);
            this._visualAvailable = false;
        }

        // Check text RAG availability with timeout
        try {
            const statusPromise = this.ragService.checkStatus();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('RAG status check timeout')), 3000)
            );

            const status = await Promise.race([statusPromise, timeoutPromise]);
            this._textAvailable = status.server_up && (status.index_ready || status.data_loaded);
        } catch (error) {
            logger.debug('[HybridSearchService] Text RAG check failed:', error.message);
            this._textAvailable = false;
        }

        logger.info('[HybridSearchService] Initialized', {
            visual: this._visualAvailable,
            text: this._textAvailable
        });
    }

    // =========================================================================
    // Availability Checks
    // =========================================================================

    /**
     * Check if hybrid search is available (at least one source)
     * @returns {Promise<{visual: boolean, text: boolean, hybrid: boolean}>}
     */
    async isAvailable() {
        // Wait for initialization to complete (with timeout) if undefined
        if (this._visualAvailable === undefined || this._textAvailable === undefined) {
             const maxWait = 5000;
             const startTime = Date.now();
             while (this._visualAvailable === undefined || this._textAvailable === undefined) {
                 if (Date.now() - startTime > maxWait) {
                     logger.warn('[HybridSearchService] Initialization timeout, assuming unavailable');
                     this._visualAvailable = false;
                     this._textAvailable = false;
                     break;
                 }
                 await new Promise(resolve => setTimeout(resolve, 100));
             }
        }

        const now = Date.now();

        // Use cached results if recent
        if ((now - this._lastCheck) < this._checkInterval) {
            return {
                visual: this._visualAvailable,
                text: this._textAvailable,
                hybrid: this._visualAvailable || this._textAvailable
            };
        }

        // Re-check logic (similar to _initializeAsync but serial and updates cache)
        await this._initializeAsync();
        this._lastCheck = now;

        return {
            visual: this._visualAvailable,
            text: this._textAvailable,
            hybrid: this._visualAvailable || this._textAvailable
        };
    }

    // =========================================================================
    // Search Methods
    // =========================================================================

    /**
     * Hybrid search combining visual and text results
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @param {number} options.k - Number of results per source (default: 10)
     * @param {number} options.maxResults - Maximum total results (default: 20)
     * @param {number} options.alpha - Visual weight override (0-1)
     * @param {boolean} options.includeOverlays - Include overlays in results
     * @returns {Promise<Object>} Fused search results
     */
    async search(query, options = {}) {
        const {
            k = 10,
            maxResults = 20,
            alpha = this.alpha,
            includeOverlays = false
        } = options;

        if (!query || typeof query !== 'string') {
            throw new Error('Query must be a non-empty string');
        }

        const startTime = Date.now();
        logger.info(`[HybridSearchService] Searching: "${query}" (k=${k}, alpha=${alpha})`);

        // Check availability
        const availability = await this.isAvailable();

        if (!availability.hybrid) {
            logger.warn('[HybridSearchService] No search sources available');
            return {
                query,
                results: [],
                totalResults: 0,
                sources: { visual: false, text: false },
                duration: Date.now() - startTime
            };
        }

        // Execute searches in parallel
        const [visualResults, textResults] = await Promise.all([
            availability.visual ? this._visualSearch(query, k) : [],
            availability.text ? this._textSearch(query, k) : []
        ]);

        logger.debug(`[HybridSearchService] Visual: ${visualResults.length}, Text: ${textResults.length}`);

        // Fuse results using RRF
        const fusedResults = this._fuseResults(visualResults, textResults, {
            k: this.rrfK,
            alpha,
            maxResults
        });

        const duration = Date.now() - startTime;

        logger.info(`[HybridSearchService] Found ${fusedResults.length} results in ${duration}ms`);

        return {
            query,
            results: fusedResults,
            totalResults: fusedResults.length,
            sources: {
                visual: visualResults.length > 0,
                text: textResults.length > 0,
                visualCount: visualResults.length,
                textCount: textResults.length
            },
            duration
        };
    }

    /**
     * Visual-only search fallback
     * @param {string} query - Search query
     * @param {number} k - Number of results
     * @returns {Promise<Object>} Visual search results
     */
    async visualSearch(query, k = 10) {
        const startTime = Date.now();

        const available = await this.visualSearchClient.isAvailable();
        if (!available) {
            return { query, results: [], totalResults: 0, source: 'visual', duration: 0 };
        }

        const results = await this._visualSearch(query, k);

        return {
            query,
            results: results.map((r, i) => ({
                ...r,
                rank: i + 1,
                source: 'visual'
            })),
            totalResults: results.length,
            source: 'visual',
            duration: Date.now() - startTime
        };
    }

    /**
     * Text-only search fallback
     * @param {string} query - Search query
     * @param {number} k - Number of results
     * @returns {Promise<Object>} Text search results
     */
    async textSearch(query, k = 10) {
        const startTime = Date.now();

        try {
            const status = await this.ragService.checkStatus();
            if (!status.index_ready && !status.data_loaded) {
                return { query, results: [], totalResults: 0, source: 'text', duration: 0 };
            }
        } catch (error) {
            return { query, results: [], totalResults: 0, source: 'text', duration: 0 };
        }

        const results = await this._textSearch(query, k);

        return {
            query,
            results: results.map((r, i) => ({
                ...r,
                rank: i + 1,
                source: 'text'
            })),
            totalResults: results.length,
            source: 'text',
            duration: Date.now() - startTime
        };
    }

    // =========================================================================
    // Internal Search Methods
    // =========================================================================

    /**
     * Execute visual search
     * @private
     */
    async _visualSearch(query, k) {
        try {
            const response = await this.visualSearchClient.search(query, { k });

            return (response.results || []).map(r => ({
                docId: r.docId,
                pageNum: r.pageNum,
                score: r.score,
                filePath: r.filePath,
                metadata: r.metadata,
                source: 'visual'
            }));
        } catch (error) {
            logger.warn('[HybridSearchService] Visual search failed:', error.message);
            return [];
        }
    }

    /**
     * Execute text RAG search
     * @private
     */
    async _textSearch(query, k) {
        try {
            const response = await this.ragService.search(query, { max_results: k });

            // Normalize text search results
            const results = Array.isArray(response) ? response : (response.results || []);

            return results.map(r => ({
                docId: r.doc_id || r.docId,
                title: r.title,
                score: r.score || r.similarity || 0,
                content: r.content?.substring(0, 500),
                correspondent: r.correspondent,
                created: r.created,
                source: 'text'
            }));
        } catch (error) {
            logger.warn('[HybridSearchService] Text search failed:', error.message);
            return [];
        }
    }

    // =========================================================================
    // Result Fusion (RRF)
    // =========================================================================

    /**
     * Fuse results using Reciprocal Rank Fusion
     * RRF formula: score(d) = Σ 1 / (k + rank(d))
     *
     * @param {Array} visualResults - Visual search results
     * @param {Array} textResults - Text search results
     * @param {Object} options - Fusion options
     * @returns {Array} Fused and ranked results
     */
    _fuseResults(visualResults, textResults, options = {}) {
        const { k = 60, alpha = 0.5, maxResults = 20 } = options;

        // Map: docId -> fusion data
        const scoreMap = new Map();

        // Score visual results (weighted by alpha)
        visualResults.forEach((result, index) => {
            const docId = result.docId;
            if (!docId) return;

            const rrfScore = 1 / (k + index + 1);
            const weightedScore = rrfScore * alpha;

            scoreMap.set(docId, {
                docId,
                fusedScore: weightedScore,
                visualRank: index + 1,
                visualScore: result.score,
                textRank: null,
                textScore: null,
                sources: ['visual'],
                data: {
                    pageNum: result.pageNum,
                    filePath: result.filePath,
                    metadata: result.metadata
                }
            });
        });

        // Score text results (weighted by 1 - alpha)
        textResults.forEach((result, index) => {
            const docId = result.docId;
            if (!docId) return;

            const rrfScore = 1 / (k + index + 1);
            const weightedScore = rrfScore * (1 - alpha);

            if (scoreMap.has(docId)) {
                // Document found in both - add scores
                const existing = scoreMap.get(docId);
                existing.fusedScore += weightedScore;
                existing.textRank = index + 1;
                existing.textScore = result.score;
                existing.sources.push('text');

                // Merge text-specific data
                existing.data.title = result.title;
                existing.data.content = result.content;
                existing.data.correspondent = result.correspondent;
                existing.data.created = result.created;
            } else {
                // New document from text only
                scoreMap.set(docId, {
                    docId,
                    fusedScore: weightedScore,
                    visualRank: null,
                    visualScore: null,
                    textRank: index + 1,
                    textScore: result.score,
                    sources: ['text'],
                    data: {
                        title: result.title,
                        content: result.content,
                        correspondent: result.correspondent,
                        created: result.created
                    }
                });
            }
        });

        // Sort by fused score (descending) and limit results
        const fusedResults = Array.from(scoreMap.values())
            .sort((a, b) => b.fusedScore - a.fusedScore)
            .slice(0, maxResults)
            .map((item, index) => ({
                rank: index + 1,
                docId: item.docId,
                fusedScore: item.fusedScore,
                visualRank: item.visualRank,
                textRank: item.textRank,
                sources: item.sources,
                inBoth: item.sources.length === 2,
                ...item.data
            }));

        return fusedResults;
    }

    /**
     * Get configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return {
            rrfK: this.rrfK,
            alpha: this.alpha,
            checkInterval: this._checkInterval
        };
    }

    /**
     * Update configuration
     * @param {Object} config - New configuration
     */
    setConfig(config) {
        if (config.rrfK !== undefined) this.rrfK = config.rrfK;
        if (config.alpha !== undefined) this.alpha = config.alpha;
        if (config.checkInterval !== undefined) this._checkInterval = config.checkInterval;
    }
}

// Export singleton and class
const hybridSearchService = new HybridSearchService();

module.exports = {
    HybridSearchService,
    hybridSearchService
};
