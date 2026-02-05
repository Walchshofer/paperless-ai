/**
 * HybridSearchService.js
 *
 * Combines visual search (ColQwen3 sidecar) with text-based RAG search
 * using weighted score fusion for improved document retrieval.
 *
 * Architecture Reference: PROMPT-004 (Hybrid Search Service)
 *
 * Weighted Formula: score = (visual_score * visual_weight)
 *                 + (text_score * text_weight)
 * Default visual weight: 0.7
 * Default text weight: 0.3
 *
 * Usage:
 *   const { hybridSearchService } = require('./services/visual-rag');
 *   const results = await hybridSearchService.search('invoice total', { k: 10 });
 */

const logger = require('../logger');

const getDefaultVisualSearchClient = () =>
    require('./VisualSearchClient').visualSearchClient;
const getDefaultRagService = () => require('../ragService');

class HybridSearchService {
    constructor(options = {}) {
        this.visualSearchClient = options.visualSearchClient ||
            getDefaultVisualSearchClient();
        this.ragService = options.ragService || getDefaultRagService();

        // Legacy RRF knob kept for compatibility with existing config payloads.
        this.rrfK = options.rrfK || 60;

        const initialWeights = this._resolveWeights({
            alpha: options.alpha,
            visualWeight: options.visualWeight ?? 0.7,
            textWeight: options.textWeight
        });
        this.visualWeight = initialWeights.visualWeight;
        this.textWeight = initialWeights.textWeight;

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
            this._textAvailable = Boolean(
            status.server_up && (status.index_ready || status.data_loaded)
        );
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
     * @param {number} options.alpha - Legacy alias for visual weight override
     * @param {number} options.visualWeight - Visual weight override (0-1)
     * @param {number} options.textWeight - Text weight override (0-1)
     * @param {boolean} options.includeOverlays - Include overlays in results
     * @returns {Promise<Object>} Fused search results
     */
    async search(query, options = {}) {
        const {
            k = 10,
            maxResults = 20,
            alpha,
            visualWeight,
            textWeight,
            includeOverlays: _includeOverlays = false
        } = options;
        const effectiveWeights = this._resolveWeights({
            alpha,
            visualWeight,
            textWeight
        });

        if (!query || typeof query !== 'string') {
            throw new Error('Query must be a non-empty string');
        }

        const startTime = Date.now();
        logger.info(
            '[HybridSearchService] Searching',
            {
                query,
                k,
                visualWeight: effectiveWeights.visualWeight,
                textWeight: effectiveWeights.textWeight
            }
        );

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

        const fusedPayload = this._fuseResults(visualResults, textResults, {
            maxResults,
            visualWeight: effectiveWeights.visualWeight,
            textWeight: effectiveWeights.textWeight
        });
        const fusedResults = fusedPayload.results;

        const duration = Date.now() - startTime;
        const fusionStats = {
            ...fusedPayload.stats,
            latencyMs: duration,
            latencyTargetMs: 2000,
            latencyTargetMet: duration < 2000
        };

        logger.info(
            '[HybridSearchService] Fusion stats',
            {
                event: 'hybrid_search_fusion_stats',
                queryLength: query.length,
                ...fusionStats
            }
        );

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
            fusionStats,
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
    // Result Fusion (Weighted)
    // =========================================================================

    /**
     * Fuse results using weighted score fusion.
     * score = (visual_score * visual_weight) + (text_score * text_weight)
     *
     * @param {Array} visualResults - Visual search results
     * @param {Array} textResults - Text search results
     * @param {Object} options - Fusion options
     * @returns {{results: Array, stats: Object}} Fused and ranked results
     */
    _fuseResults(visualResults, textResults, options = {}) {
        const {
            maxResults = 20,
            visualWeight = this.visualWeight,
            textWeight = this.textWeight
        } = options;

        const dedupedVisual = this._dedupeByDocId(visualResults);
        const dedupedText = this._dedupeByDocId(textResults);
        const scoreMap = new Map();

        dedupedVisual.forEach(result => {
            const docId = result.docId;
            const normalizedVisualScore = this._normalizeScore(result.score);

            scoreMap.set(docId, {
                docId,
                fusedScore: normalizedVisualScore * visualWeight,
                visualRank: result.rank,
                visualScore: normalizedVisualScore,
                visualRawScore: this._toFiniteNumber(result.score),
                textRank: null,
                textScore: null,
                textRawScore: null,
                sources: ['visual'],
                data: {
                    pageNum: result.pageNum,
                    filePath: result.filePath,
                    metadata: result.metadata
                }
            });
        });

        dedupedText.forEach(result => {
            const docId = result.docId;
            const normalizedTextScore = this._normalizeScore(result.score);

            if (scoreMap.has(docId)) {
                const existing = scoreMap.get(docId);
                existing.fusedScore += normalizedTextScore * textWeight;
                existing.textRank = result.rank;
                existing.textScore = normalizedTextScore;
                existing.textRawScore = this._toFiniteNumber(result.score);
                existing.sources.push('text');

                existing.data.title = result.title;
                existing.data.content = result.content;
                existing.data.correspondent = result.correspondent;
                existing.data.created = result.created;
            } else {
                scoreMap.set(docId, {
                    docId,
                    fusedScore: normalizedTextScore * textWeight,
                    visualRank: null,
                    visualScore: null,
                    visualRawScore: null,
                    textRank: result.rank,
                    textScore: normalizedTextScore,
                    textRawScore: this._toFiniteNumber(result.score),
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

        const fusedResults = Array.from(scoreMap.values())
            .sort((a, b) => b.fusedScore - a.fusedScore)
            .slice(0, maxResults)
            .map((item, index) => ({
                rank: index + 1,
                docId: item.docId,
                fusedScore: item.fusedScore,
                score: item.fusedScore,
                visualRank: item.visualRank,
                textRank: item.textRank,
                visualScore: item.visualScore,
                textScore: item.textScore,
                visualRawScore: item.visualRawScore,
                textRawScore: item.textRawScore,
                sources: item.sources,
                source: item.sources.length === 1 ? item.sources[0] : 'hybrid',
                inBoth: item.sources.length === 2,
                fusion: {
                    method: 'weighted_score',
                    visualWeight,
                    textWeight
                },
                ...item.data
            }));

        const overlapCount = fusedResults.filter(item => item.inBoth).length;
        return {
            results: fusedResults,
            stats: {
                fusionMethod: 'weighted_score',
                visualWeight,
                textWeight,
                visualInputCount: visualResults.length,
                textInputCount: textResults.length,
                visualDedupedCount: dedupedVisual.length,
                textDedupedCount: dedupedText.length,
                overlapCount,
                totalResults: fusedResults.length
            }
        };
    }

    _resolveWeights(options = {}) {
        let visualWeight = options.visualWeight;
        let textWeight = options.textWeight;

        if (visualWeight === undefined && options.alpha !== undefined) {
            visualWeight = options.alpha;
        }

        if (visualWeight === undefined && textWeight === undefined) {
            return {
                visualWeight: this.visualWeight ?? 0.7,
                textWeight: this.textWeight ?? 0.3
            };
        }

        if (visualWeight !== undefined && textWeight === undefined) {
            const normalizedVisualWeight = this._normalizeWeight(visualWeight, 0.7);
            return {
                visualWeight: normalizedVisualWeight,
                textWeight: 1 - normalizedVisualWeight
            };
        }

        if (visualWeight === undefined && textWeight !== undefined) {
            const normalizedTextWeight = this._normalizeWeight(textWeight, 0.3);
            return {
                visualWeight: 1 - normalizedTextWeight,
                textWeight: normalizedTextWeight
            };
        }

        const safeVisual = this._normalizeWeight(visualWeight, 0.7);
        const safeText = this._normalizeWeight(textWeight, 0.3);
        const sum = safeVisual + safeText;
        if (sum <= 0) {
            return { visualWeight: 0.7, textWeight: 0.3 };
        }
        return {
            visualWeight: safeVisual / sum,
            textWeight: safeText / sum
        };
    }

    _normalizeWeight(value, fallback) {
        const numberValue = this._toFiniteNumber(value);
        if (numberValue === null) {
            return fallback;
        }
        if (numberValue < 0) {
            return 0;
        }
        if (numberValue > 1) {
            return 1;
        }
        return numberValue;
    }

    _toFiniteNumber(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return null;
        }
        return value;
    }

    _normalizeScore(score) {
        const numericScore = this._toFiniteNumber(score);
        if (numericScore === null) {
            return 0;
        }
        if (numericScore < 0) {
            return 0;
        }
        if (numericScore > 1) {
            return 1;
        }
        return numericScore;
    }

    _dedupeByDocId(results) {
        const bestByDoc = new Map();
        (results || []).forEach((result, index) => {
            const docId = result?.docId;
            if (docId === null || docId === undefined) {
                return;
            }
            const candidateScore = this._normalizeScore(result.score);
            const existing = bestByDoc.get(docId);
            if (!existing || candidateScore > this._normalizeScore(existing.score)) {
                bestByDoc.set(docId, {
                    ...result,
                    rank: index + 1
                });
            }
        });
        return Array.from(bestByDoc.values()).sort(
            (left, right) => this._normalizeScore(right.score) -
                this._normalizeScore(left.score)
        );
    }

    /**
     * Get configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return {
            rrfK: this.rrfK,
            alpha: this.visualWeight,
            visualWeight: this.visualWeight,
            textWeight: this.textWeight,
            checkInterval: this._checkInterval
        };
    }

    /**
     * Update configuration
     * @param {Object} config - New configuration
     */
    setConfig(config) {
        if (config.rrfK !== undefined) this.rrfK = config.rrfK;
        if (config.alpha !== undefined ||
            config.visualWeight !== undefined ||
            config.textWeight !== undefined) {
            const resolvedWeights = this._resolveWeights({
                alpha: config.alpha,
                visualWeight: config.visualWeight,
                textWeight: config.textWeight
            });
            this.visualWeight = resolvedWeights.visualWeight;
            this.textWeight = resolvedWeights.textWeight;
        }
        if (config.checkInterval !== undefined) this._checkInterval = config.checkInterval;
    }
}

// Export singleton and class (lazy init to avoid heavy deps in tests)
let hybridSearchServiceInstance;

function getHybridSearchService() {
    if (!hybridSearchServiceInstance) {
        hybridSearchServiceInstance = new HybridSearchService();
    }
    return hybridSearchServiceInstance;
}

const exportsObj = {
    HybridSearchService,
    getHybridSearchService
};

Object.defineProperty(exportsObj, 'hybridSearchService', {
    enumerable: true,
    get: () => getHybridSearchService()
});

module.exports = exportsObj;
