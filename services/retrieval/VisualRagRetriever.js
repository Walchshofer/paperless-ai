/**
 * VisualRagRetriever.js
 *
 * MoE-aware hybrid retrieval service for Visual RAG.
 * Combines visual search, text search, and expert routing for optimal results.
 *
 * Architecture Reference: MoE DMS Principles
 * - "Keep intelligence flexible, keep knowledge structured"
 * - Experts do query-side specialization at runtime
 * - Store structured metadata per document, not full Q&A pairs
 *
 * Retrieval Flow:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                        VISUAL RAG RETRIEVER                             │
 * │                                                                         │
 * │  Query → ┬─→ [Visual Search] → Tomoro Sidecar                          │
 * │          │                                                              │
 * │          ├─→ [Text Search] → Expert Knowledge DB                       │
 * │          │                                                              │
 * │          └─→ [Domain Signals] → MoE Filtering                          │
 * │                      ↓                                                  │
 * │               MoE Reranking → expert_routing_weights                   │
 * │                      ↓                                                  │
 * │               Quality Filter → retrieval_quality_score >= 0.7          │
 * │                      ↓                                                  │
 * │               Top-K Results with expert context                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

const logger = require('../logger');
const config = require('../../config/config');
const { visualOverlayRepository } = require('../visual-rag-client/VisualOverlayRepository');
const { ingestionManager } = require('../visual-rag-client/IngestionManager');

class VisualRagRetriever {
    constructor(options = {}) {
        this.overlayRepository = options.overlayRepository || visualOverlayRepository;
        this.ingestionManager = options.ingestionManager || ingestionManager;

        // Expert weights configuration
        this.expertWeights = options.expertWeights || config.moeRetrieval?.expertWeights || {
            financial: 1.0,
            medical: 1.0,
            legal: 1.0,
            general: 0.8
        };

        // Quality thresholds
        this.minQualityScore = options.minQualityScore || config.moeRetrieval?.minQualityScore || 0.7;

        // Statistics
        this.stats = {
            totalQueries: 0,
            moeRerankings: 0,
            domainSignalFilters: 0,
            averageResultsReturned: 0
        };
    }

    /**
     * Retrieve documents with MoE-aware ranking
     *
     * @param {string} query - Search query
     * @param {Object} options - Retrieval options
     * @param {string} options.domain - Query domain for expert routing
     * @param {Array<string>} options.domainSignals - Domain signals for filtering
     * @param {number} options.k - Number of results (default: 10)
     * @param {boolean} options.includeExpertKnowledge - Include expert metadata (default: true)
     * @returns {Promise<Object>} Retrieval results with MoE scores
     */
    async retrieve(query, options = {}) {
        const startTime = Date.now();
        this.stats.totalQueries++;

        const {
            domain = 'general',
            domainSignals = [],
            k = 10,
            includeExpertKnowledge = true,
            minQuality = this.minQualityScore
        } = options;

        logger.debug({
            event: 'moe_retrieval_start',
            query: query.substring(0, 100),
            domain,
            domainSignals,
            k
        });

        // Parallel retrieval paths
        const [visualResults, expertResults] = await Promise.all([
            this._retrieveVisual(query, { k: k * 2 }),  // Over-fetch for reranking
            this._retrieveBySignals(domainSignals, { limit: k * 2, minQuality })
        ]);

        // Merge and deduplicate results
        const mergedResults = this._mergeResults(visualResults, expertResults);

        // Apply MoE reranking
        const rerankedResults = this._rerankWithExpertWeights(mergedResults, domain);
        this.stats.moeRerankings++;

        // Take top-k after reranking
        const topResults = rerankedResults.slice(0, k);

        // Enrich with expert knowledge if requested
        if (includeExpertKnowledge) {
            await this._enrichWithExpertKnowledge(topResults);
        }

        const duration = Date.now() - startTime;

        // Update stats
        const n = this.stats.totalQueries;
        this.stats.averageResultsReturned =
            ((this.stats.averageResultsReturned * (n - 1)) + topResults.length) / n;

        logger.info({
            event: 'moe_retrieval_complete',
            query: query.substring(0, 50),
            domain,
            resultsReturned: topResults.length,
            durationMs: duration
        });

        return {
            query,
            domain,
            results: topResults,
            totalResults: topResults.length,
            metadata: {
                visualResultsCount: visualResults.length,
                expertResultsCount: expertResults.length,
                mergedCount: mergedResults.length,
                durationMs: duration
            }
        };
    }

    /**
     * Retrieve with domain signals (MoE filtering)
     *
     * @param {Array<string>} signals - Domain signals to match
     * @param {Object} options - Retrieval options
     * @returns {Promise<Object>} Matching documents
     */
    async retrieveWithDomainSignals(signals, options = {}) {
        this.stats.domainSignalFilters++;

        const { limit = 20, minQuality = this.minQualityScore } = options;

        const results = await this._retrieveBySignals(signals, { limit, minQuality });

        return {
            signals,
            results,
            totalResults: results.length
        };
    }

    /**
     * Get expert knowledge for a specific document
     *
     * @param {number} docId - Paperless document ID
     * @returns {Promise<Object|null>} Expert knowledge or null
     */
    async getExpertKnowledge(docId) {
        return this.overlayRepository.getExpertKnowledge(docId);
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    /**
     * Retrieve via visual search (Tomoro sidecar)
     * @private
     */
    async _retrieveVisual(query, options = {}) {
        try {
            const searchResults = await this.ingestionManager.visualSearch(query, {
                k: options.k || 20,
                includeOverlays: false
            });

            if (!searchResults || !searchResults.results) {
                return [];
            }

            return searchResults.results.map(r => ({
                docId: r.docId,
                pageNum: r.pageNum,
                score: r.score || 0,
                source: 'visual',
                text: r.text
            }));
        } catch (error) {
            logger.warn({
                event: 'visual_retrieval_failed',
                error: error.message
            });
            return [];
        }
    }

    /**
     * Retrieve by domain signals from expert knowledge
     * @private
     */
    async _retrieveBySignals(signals, options = {}) {
        if (!signals || signals.length === 0) {
            return [];
        }

        try {
            const results = await this.overlayRepository.findByDomainSignals(signals, options);

            return results.map(r => ({
                docId: r.docId,
                score: r.qualityScore || 0,
                source: 'expert_signals',
                domainSignals: r.domainSignals,
                routingWeights: r.routingWeights,
                expertMetadata: r.expertMetadata
            }));
        } catch (error) {
            logger.warn({
                event: 'signal_retrieval_failed',
                error: error.message
            });
            return [];
        }
    }

    /**
     * Merge results from different retrieval paths
     * @private
     */
    _mergeResults(visualResults, expertResults) {
        const mergedMap = new Map();

        // Add visual results
        for (const r of visualResults) {
            const key = `${r.docId}-${r.pageNum || 0}`;
            mergedMap.set(key, {
                ...r,
                visualScore: r.score
            });
        }

        // Merge expert results (boost score if already exists)
        for (const r of expertResults) {
            const key = `${r.docId}-0`;  // Expert knowledge is page 0
            const existing = mergedMap.get(key);

            if (existing) {
                existing.expertScore = r.score;
                existing.routingWeights = r.routingWeights;
                existing.expertMetadata = r.expertMetadata;
                existing.domainSignals = r.domainSignals;
            } else {
                mergedMap.set(key, {
                    ...r,
                    expertScore: r.score
                });
            }
        }

        return Array.from(mergedMap.values());
    }

    /**
     * Rerank results using MoE expert routing weights
     * @private
     */
    _rerankWithExpertWeights(results, queryDomain) {
        return results
            .map(r => ({
                ...r,
                moeScore: this._computeMoeScore(r, queryDomain)
            }))
            .sort((a, b) => b.moeScore - a.moeScore);
    }

    /**
     * Compute MoE-weighted score for a result
     * @private
     */
    _computeMoeScore(result, queryDomain) {
        // Base score from retrieval
        const baseScore = Math.max(
            result.visualScore || 0,
            result.expertScore || 0,
            result.score || 0
        );

        // Get routing weights (default to base if not available)
        const routingWeights = result.routingWeights || {};
        const domainBoost = routingWeights[queryDomain] || 0;

        // Expert weight from configuration
        const expertWeight = this.expertWeights[queryDomain] || 0.8;

        // Quality factor (if available)
        const qualityFactor = result.qualityScore ||
                              result.expertMetadata?.extraction_quality === 'high' ? 1.0 :
                              result.expertMetadata?.extraction_quality === 'medium' ? 0.8 :
                              0.6;

        // Combined MoE score:
        // base_score * (1 + domain_boost * 0.3) * expert_weight * quality_factor
        return baseScore * (1 + domainBoost * 0.3) * expertWeight * qualityFactor;
    }

    /**
     * Enrich results with full expert knowledge
     * @private
     */
    async _enrichWithExpertKnowledge(results) {
        for (const result of results) {
            if (!result.expertMetadata) {
                const knowledge = await this.getExpertKnowledge(result.docId);
                if (knowledge) {
                    result.expertMetadata = knowledge.expertMetadata;
                    result.enhancedOcrText = knowledge.enhancedOcrText?.substring(0, 1000);
                    result.domainView = knowledge.domainView;
                }
            }
        }
    }

    /**
     * Get retrieval statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalQueries: 0,
            moeRerankings: 0,
            domainSignalFilters: 0,
            averageResultsReturned: 0
        };
    }
}

// Export singleton and class
const visualRagRetriever = new VisualRagRetriever();

module.exports = {
    VisualRagRetriever,
    visualRagRetriever
};
