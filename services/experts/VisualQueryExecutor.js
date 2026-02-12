/**
 * VisualQueryExecutor.js
 *
 * Phase 4: Visual Query Execution
 *
 * Executes visual queries against the Visual RAG sidecar and merges results
 * with extraction output. Applies circuit breaker protection, deduplication,
 * and confidence score fusion.
 *
 * Architecture Reference: SSOT Retrieval Broker + Visual RAG Integration, Phase 4
 * Prerequisites: Phase 1 (CircuitBreaker), Phase 2 (Parallel OCR), Phase 3 (Visual Query Generation)
 */

const logger = require('../logger');
const { metricsCollector } = require('../metrics/PrometheusMetrics');
const { CircuitBreaker, CircuitState } = require('./CircuitBreaker');
const paperlessService = require('../paperlessService');
const { OcrGuidedVisualSearch } = require('./OcrGuidedVisualSearch');
const { HybridConfidenceFusion } = require('./HybridConfidenceFusion');

/**
 * Base K values for different query types
 */
const BASE_K_VALUES = {
    field_extraction: 3,
    validation: 5,
    exploration: 10
};

/**
 * Default configuration for query execution
 */
const DEFAULT_CONFIG = {
    timeoutBudget: 500,          // 500ms per query budget
    hardTimeout: 1000,           // 1000ms hard timeout
    maxConcurrentQueries: 5,     // Max 5 concurrent queries
    maxDynamicK: 10,             // Keep dynamic K bounded for latency
    maxRetries: 3,               // Retry failed queries up to 3 times
    initialBackoff: 100,         // Initial backoff: 100ms
    backoffMultiplier: 2,        // Exponential backoff: 100, 200, 400
    iouThreshold: 0.7,           // IoU threshold for deduplication
    ocrWeight: 0.4,              // Confidence fusion: OCR weight
    visualWeight: 0.6,           // Confidence fusion: visual weight
    ocrConfirmedBoostMin: 0.15,  // Confidence boost range for confirmed values
    ocrConfirmedBoostMax: 0.2,
    arbitratedBoostMin: 0.05,    // Confidence boost range for arbitration
    arbitratedBoostMax: 0.1,
    visualOnlyPenalty: 0.1,      // Confidence penalty when OCR value is missing
    failureThreshold: 3,         // Circuit breaker failure threshold
    cooldownPeriod: 30000,       // Circuit breaker cooldown: 30s
    ocrFallbackEnabled: false,   // Opt-in OCR-guided visual fallback
    ocrFallbackConfidenceThreshold: 0.7,
    ocrFallbackMaxQueries: 5,
    ocrFallbackMaxQueryLength: 140,
    ocrFallbackMinValueLength: 3,
    ocrFallbackOcrTimeoutMs: 1500,
    ocrFallbackMaxKeyTerms: 12,
    ocrFallbackMinOcrLength: 20,
    ocrFallbackMaxOcrChars: 2000,
    ocrCrossValidationEnabled: true,
    ocrCrossValidationTimeoutMs: 1500
};

/**
 * VisualQueryExecutor - Executes visual queries and merges results
 *
 * Responsibilities:
 * 1. Execute queries against Visual RAG sidecar
 * 2. Calculate dynamic K per query
 * 3. Deduplicate overlapping bounding boxes (IoU)
 * 4. Merge visual results with extraction output
 * 5. Update field confidence scores
 * 6. Calculate overlay positions
 * 7. Handle failures gracefully (circuit breaker protection)
 */
class VisualQueryExecutor {
    /**
     * @param {Object} visualSearchClient - Visual RAG sidecar client
     * @param {Object} options - Executor configuration
     */
    constructor(visualSearchClient, overlayRepository = null, options = {}) {
        if (overlayRepository && typeof overlayRepository.getByDocIdAndPage !== 'function') {
            options = overlayRepository;
            overlayRepository = null;
        }

        this.visualSearchClient = visualSearchClient;
        this.overlayRepository = overlayRepository;
        const {
            metricsCollector: providedMetrics,
            paperlessService: providedPaperlessService,
            ocrGuidedSearch: providedOcrGuidedSearch,
            hybridConfidenceFusion: providedHybridConfidenceFusion,
            ...executorOptions
        } = options;
        this.metricsCollector = providedMetrics || metricsCollector || null;
        this.paperlessService = providedPaperlessService || paperlessService;
        const normalizedOptions = { ...executorOptions };
        const legacyExtractionWeight = Number(normalizedOptions.extractionWeight);
        if (
            Number.isFinite(legacyExtractionWeight) &&
            !Number.isFinite(Number(normalizedOptions.ocrWeight))
        ) {
            normalizedOptions.ocrWeight = legacyExtractionWeight;
        }
        this.config = {
            ...DEFAULT_CONFIG,
            ...normalizedOptions
        };
        this.hybridConfidenceFusion = providedHybridConfidenceFusion ||
            new HybridConfidenceFusion({
                visualWeight: this.config.visualWeight,
                ocrWeight: this.config.ocrWeight,
                ocrConfirmedBoostMin: this.config.ocrConfirmedBoostMin,
                ocrConfirmedBoostMax: this.config.ocrConfirmedBoostMax,
                arbitratedBoostMin: this.config.arbitratedBoostMin,
                arbitratedBoostMax: this.config.arbitratedBoostMax,
                visualOnlyPenalty: this.config.visualOnlyPenalty
            });

        this.ocrGuidedSearch = providedOcrGuidedSearch ||
            new OcrGuidedVisualSearch({
                paperlessService: this.paperlessService,
                metricsCollector: this.metricsCollector,
                maxQueries: this.config.ocrFallbackMaxQueries,
                maxQueryLength: this.config.ocrFallbackMaxQueryLength,
                minValueLength: this.config.ocrFallbackMinValueLength,
                maxKeyTerms: this.config.ocrFallbackMaxKeyTerms,
                minOcrLength: this.config.ocrFallbackMinOcrLength,
                maxOcrChars: this.config.ocrFallbackMaxOcrChars,
                ocrFetchTimeoutMs: this.config.ocrFallbackOcrTimeoutMs,
                crossValidationEnabled: this.config.ocrCrossValidationEnabled,
                crossValidationTimeoutMs: this.config.ocrCrossValidationTimeoutMs
            });

        // Initialize circuit breaker for sidecar protection
        this.circuitBreaker = new CircuitBreaker('visual-rag-sidecar', {
            failureThreshold: this.config.failureThreshold,
            cooldownPeriod: this.config.cooldownPeriod,
            timeout: this.config.timeoutBudget,
            hardTimeout: this.config.hardTimeout,
            maxRetries: this.config.maxRetries,
            initialBackoff: this.config.initialBackoff,
            backoffMultiplier: this.config.backoffMultiplier
        }, this.metricsCollector);

        this.stats = {
            totalQueriesExecuted: 0,
            successfulQueries: 0,
            failedQueries: 0,
            timeoutQueries: 0,
            circuitBreakerRejections: 0,
            totalLatencyMs: 0,
            averageLatencyMs: 0
        };
    }

    /**
     * Execute visual queries and merge with extraction results
     *
     * @param {Object} params - Execution parameters
     * @param {Array} params.visualQueries - Queries from Phase 3
     * @param {Object} params.extractionResults - Extraction results
     * @param {Object} params.documentMetadata - Document metadata
     * @param {Buffer|String} params.documentImage - Document image for visual search
     * @returns {Object} Merged results with visual confirmations
     */
    async executeQueries(params) {
        const {
            visualQueries = [],
            extractionResults = {},
            documentMetadata = {},
            documentImage = null
        } = params;

        const startTime = Date.now();

        // Check circuit breaker state
        if (this.circuitBreaker.state === CircuitState.OPEN) {
            logger.warn({
                event: 'visual_query_execution_circuit_open',
                documentId: documentMetadata.id,
                message: 'Circuit breaker OPEN - skipping visual queries'
            });

            const fallback = this._buildFallbackResult(
                extractionResults,
                startTime,
                'circuit_breaker_open'
            );
            if (this.metricsCollector?.observeVisualQueryExecutionTime) {
                this.metricsCollector.observeVisualQueryExecutionTime(
                    documentMetadata.documentType,
                    Date.now() - startTime
                );
            }
            if (this.metricsCollector?.recordVisualConfirmationRate) {
                this.metricsCollector.recordVisualConfirmationRate(
                    documentMetadata.documentType,
                    fallback.execution_metadata.visual_confirmation_rate
                );
            }
            return fallback;
        }

        // If no queries or no image, return extraction-only results
        if (!visualQueries || visualQueries.length === 0) {
            logger.info({
                event: 'visual_query_execution_skipped',
                reason: 'no_queries',
                documentId: documentMetadata.id
            });

            const fallback = this._buildFallbackResult(extractionResults, startTime, 'no_queries');
            if (this.metricsCollector?.observeVisualQueryExecutionTime) {
                this.metricsCollector.observeVisualQueryExecutionTime(
                    documentMetadata.documentType,
                    Date.now() - startTime
                );
            }
            if (this.metricsCollector?.recordVisualConfirmationRate) {
                this.metricsCollector.recordVisualConfirmationRate(
                    documentMetadata.documentType,
                    fallback.execution_metadata.visual_confirmation_rate
                );
            }
            return fallback;
        }

        // Require a document image for visual search; otherwise degrade gracefully
        if (!documentImage) {
            logger.info({
                event: 'visual_query_execution_skipped',
                reason: 'no_image',
                documentId: documentMetadata.id
            });

            const fallback = this._buildFallbackResult(extractionResults, startTime, 'no_image');
            if (this.metricsCollector?.observeVisualQueryExecutionTime) {
                this.metricsCollector.observeVisualQueryExecutionTime(
                    documentMetadata.documentType,
                    Date.now() - startTime
                );
            }
            if (this.metricsCollector?.recordVisualConfirmationRate) {
                this.metricsCollector.recordVisualConfirmationRate(
                    documentMetadata.documentType,
                    fallback.execution_metadata.visual_confirmation_rate
                );
            }
            return fallback;
        }

        try {
            logger.info({
                event: 'visual_query_execution_start',
                documentId: documentMetadata.id,
                queryCount: visualQueries.length
            });

            // Execute queries with circuit breaker protection
            const queryResults = await this._executeQueriesWithCircuitBreaker(
                visualQueries,
                documentImage,
                documentMetadata
            );

            // Deduplicate bounding boxes across all results
            const dedupedResults = this._deduplicateBoundingBoxes(queryResults);

            // Merge visual results with extraction results
            const mergedFields = this._mergeResults(
                extractionResults,
                dedupedResults,
                visualQueries
            );
            let fusionSummary = this._summarizeFusionStates(mergedFields);

            // Calculate overlay positions
            const overlays = this._calculateOverlays(dedupedResults);

            const kValues = this._buildKValues(queryResults);
            const dedupStats = this._buildDedupStats(queryResults, dedupedResults);
            const visualConfidence = this._calculateVisualConfidence(queryResults);

            // Build metadata
            let metadata = this._buildMetadata(queryResults, startTime, {
                kValues,
                dedupStats,
                visualConfidence,
                fusionSummary
            });

            let result = {
                fields: mergedFields,
                newly_discovered_fields: this._extractNewlyDiscovered(mergedFields),
                overlays,
                execution_metadata: metadata
            };

            if (this._shouldTriggerOcrFallback(metadata, mergedFields, documentMetadata)) {
                result = await this.executeWithOcrFallback(
                    result,
                    documentMetadata,
                    {
                        visualQueries,
                        extractionResults,
                        queryResults,
                        dedupedResults,
                        documentImage,
                        startTime
                    }
                );
                metadata = result.execution_metadata || metadata;
                fusionSummary = this._summarizeFusionStates(result.fields);
                metadata.hybrid_confidence_fusion = fusionSummary;
            }

            this._recordHybridFusionTelemetry(
                documentMetadata,
                fusionSummary,
                result.fields
            );

            const kSummary = metadata.k_summary || this._buildKSummary(kValues);
            logger.info({
                event: 'visual_query_execution_complete',
                documentId: documentMetadata.id,
                successfulQueries: metadata.successful_queries,
                failedQueries: metadata.failed_queries,
                durationMs: Date.now() - startTime,
                visualConfidence: metadata.visual_confidence,
                kSummary,
                rawHitCount: metadata.raw_hit_count,
                deduplicatedCount: metadata.deduplicated_count,
                hybridFusionSummary: metadata.hybrid_confidence_fusion || null,
                ocrFallbackUsed: metadata.ocr_fallback_used || false
            });
            if (this.metricsCollector?.observeVisualQueryExecutionTime) {
                this.metricsCollector.observeVisualQueryExecutionTime(
                    documentMetadata.documentType,
                    Date.now() - startTime
                );
            }
            if (this.metricsCollector?.recordVisualConfirmationRate) {
                this.metricsCollector.recordVisualConfirmationRate(
                    documentMetadata.documentType,
                    metadata.visual_confirmation_rate
                );
            }
            return result;

        } catch (error) {
            logger.error({
                event: 'visual_query_execution_failed',
                documentId: documentMetadata.id,
                error: error.message,
                stack: error.stack
            });

            // Graceful degradation: return extraction-only results
            const fallback = this._buildFallbackResult(extractionResults, startTime, 'error', error);
            if (this.metricsCollector?.observeVisualQueryExecutionTime) {
                this.metricsCollector.observeVisualQueryExecutionTime(
                    documentMetadata.documentType,
                    Date.now() - startTime
                );
            }
            if (this.metricsCollector?.recordVisualConfirmationRate) {
                this.metricsCollector.recordVisualConfirmationRate(
                    documentMetadata.documentType,
                    fallback.execution_metadata.visual_confirmation_rate
                );
            }
            return fallback;
        }
    }

    /**
     * Execute queries with circuit breaker protection and concurrency control
     * @private
     */
    async _executeQueriesWithCircuitBreaker(visualQueries, documentImage, documentMetadata) {
        const results = [];
        const concurrencyLimit = this.config.maxConcurrentQueries;

        // Process queries in batches to respect concurrency limit
        for (let i = 0; i < visualQueries.length; i += concurrencyLimit) {
            const batch = visualQueries.slice(i, i + concurrencyLimit);

            const batchPromises = batch.map(query =>
                this._executeQueryWithRetry(query, documentImage, documentMetadata)
            );

            const batchResults = await Promise.allSettled(batchPromises);

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    results.push({
                        success: false,
                        error: result.reason?.message || 'Unknown error',
                        bounding_boxes: []
                    });
                }
            }
        }

        return results;
    }

    /**
     * Execute a single query with retry logic
     * @private
     */
    async _executeQueryWithRetry(query, documentImage, documentMetadata) {
        const startTime = Date.now();
        let k = 0;
        if (this.metricsCollector?.incrementVisualQueriesExecuted) {
            this.metricsCollector.incrementVisualQueriesExecuted(
                documentMetadata.documentType,
                query.expected_element_type
            );
        }

        try {
            // Calculate dynamic K for this query
            k = this._calculateDynamicK(query);

            // Execute via circuit breaker
            const cbResult = await this.circuitBreaker.execute(async () => {
                return await this._executeVisualSearch(
                    query.question,
                    documentImage,
                    k,
                    documentMetadata,
                    query.expected_element_type
                );
            });

            if (!cbResult.success || cbResult.fallback) {
                throw cbResult.error || new Error('Circuit breaker prevented execution');
            }

            const result = cbResult.data || {};
            const latency = Date.now() - startTime;

            this._updateStats(true, false, latency);

            return {
                success: true,
                query,
                k,
                bounding_boxes: result.bounding_boxes || [],
                scores: result.scores || [],
                page_numbers: result.page_numbers || [],
                latency
            };

        } catch (error) {
            const latency = Date.now() - startTime;
            const isTimeout = error.message?.includes('timeout') || latency >= this.config.hardTimeout;
            const errorStatus = error?.status;
            const errorType = error?.type;

            this._updateStats(false, isTimeout, latency);
            if (isTimeout && this.metricsCollector?.recordVisualQueryTimeout) {
                this.metricsCollector.recordVisualQueryTimeout(
                    documentMetadata.documentType,
                    query.expected_element_type
                );
            }

            logger.warn({
                event: 'visual_query_failed',
                query: query.field_target,
                error: error.message,
                isTimeout,
                latency
            });

            return {
                success: false,
                query,
                k,
                error: error.message,
                error_status: errorStatus,
                error_type: errorType,
                isTimeout,
                bounding_boxes: [],
                latency
            };
        }
    }

    /**
     * Execute visual search against sidecar
     * @private
     */
    async _executeVisualSearch(question, documentImage, k, documentMetadata, queryType) {
        logger.debug({
            event: 'visual_search_call',
            question,
            k,
            documentId: documentMetadata.id
        });

        const response = await this.visualSearchClient.search(question, { k, queryType });

        if (response && Array.isArray(response.bounding_boxes)) {
            return {
                bounding_boxes: response.bounding_boxes,
                scores: response.scores || [],
                page_numbers: response.page_numbers || []
            };
        }

        const docId = documentMetadata?.id;
        const results = response?.results || [];
        if (!docId || !Array.isArray(results) || results.length === 0) {
            return { bounding_boxes: [], scores: [], page_numbers: [] };
        }

        const matching = results.filter(result => String(result.docId) === String(docId));
        if (matching.length === 0) {
            return { bounding_boxes: [], scores: [], page_numbers: [] };
        }

        if (!this.overlayRepository ||
            typeof this.overlayRepository.getByDocIdAndPage !== 'function') {
            logger.debug({
                event: 'visual_overlay_repository_unavailable',
                documentId: docId
            });
            return { bounding_boxes: [], scores: [], page_numbers: [] };
        }

        let overlayAvailable = true;
        if (typeof this.overlayRepository.isAvailable === 'function') {
            try {
                overlayAvailable = await this.overlayRepository.isAvailable(false);
            } catch (error) {
                overlayAvailable = false;
                logger.warn({
                    event: 'visual_overlay_repository_check_failed',
                    documentId: docId,
                    error: error.message
                });
            }
        }

        if (!overlayAvailable) {
            return { bounding_boxes: [], scores: [], page_numbers: [] };
        }

        const pageScores = new Map();
        for (const result of matching) {
            const pageNumber = result.pageNum;
            if (!pageNumber) {
                continue;
            }
            const score = typeof result.score === 'number' ? result.score : 0;
            const existing = pageScores.get(pageNumber);
            if (existing === undefined || score > existing) {
                pageScores.set(pageNumber, score);
            }
        }

        const boundingBoxes = [];
        const scores = [];
        const pageNumbers = [];

        for (const [pageNumber, score] of pageScores.entries()) {
            const overlays = await this.overlayRepository.getByDocIdAndPage(docId, pageNumber);
            for (const overlay of overlays) {
                const normalized = this._normalizeOverlayBox(overlay?.box);
                if (!normalized) {
                    continue;
                }
                const overlayScore = typeof overlay?.confidence === 'number'
                    ? overlay.confidence
                    : score;
                boundingBoxes.push(normalized);
                scores.push(overlayScore);
                pageNumbers.push(pageNumber);
            }
        }

        return {
            bounding_boxes: boundingBoxes,
            scores,
            page_numbers: pageNumbers
        };
    }

    /**
     * Calculate dynamic K based on query type, confidence, and rarity
     * Formula: K = base_K * (1 + (1 - confidence) * 0.5) * (1 + rarity_factor)
     * @private
     */
    _calculateDynamicK(query) {
        const safeQuery = query && typeof query === 'object' ? query : {};
        const baseK = BASE_K_VALUES[safeQuery.expected_element_type] ||
            BASE_K_VALUES.field_extraction;
        const confidence = Number(safeQuery.confidence);
        const rarity = Number(safeQuery.rarity_factor);
        const normalizedConfidence = Number.isFinite(confidence)
            ? Math.max(0, Math.min(1, confidence))
            : 1;
        const normalizedRarity = Number.isFinite(rarity)
            ? Math.max(0, rarity)
            : 0;
        const confidenceFactor = 1 + (1 - normalizedConfidence);
        const rarityFactor = 1 + normalizedRarity;
        const dynamicK = baseK * confidenceFactor * rarityFactor;
        const maxDynamicK = Number.isFinite(this.config.maxDynamicK)
            ? this.config.maxDynamicK
            : DEFAULT_CONFIG.maxDynamicK;
        const boundedK = Math.min(dynamicK, maxDynamicK);

        return Math.max(1, Math.round(boundedK));
    }

    _buildKValues(queryResults) {
        if (!Array.isArray(queryResults)) {
            return [];
        }

        return queryResults
            .filter(result => Number.isFinite(result.k))
            .map(result => ({
                field_target: result.query?.field_target || null,
                expected_element_type: result.query?.expected_element_type || null,
                k: result.k
            }));
    }

    _buildKSummary(kValues) {
        const values = Array.isArray(kValues)
            ? kValues.map(item => item.k).filter(Number.isFinite)
            : [];

        if (values.length === 0) {
            return { min: 0, max: 0, avg: 0 };
        }

        const sum = values.reduce((total, value) => total + value, 0);
        return {
            min: Math.min(...values),
            max: Math.max(...values),
            avg: sum / values.length
        };
    }

    _buildDedupStats(queryResults, dedupedResults) {
        const results = Array.isArray(queryResults) ? queryResults : [];
        const rawHitCount = results.reduce((sum, result) => {
            if (!Array.isArray(result.bounding_boxes)) {
                return sum;
            }
            return sum + result.bounding_boxes.length;
        }, 0);
        const dedupedCount = Array.isArray(dedupedResults) ? dedupedResults.length : 0;

        return {
            raw_hit_count: rawHitCount,
            deduplicated_count: dedupedCount,
            dedup_removed_count: Math.max(0, rawHitCount - dedupedCount)
        };
    }

    _calculateVisualConfidence(queryResults) {
        if (!Array.isArray(queryResults) || queryResults.length === 0) {
            return 0;
        }

        const bestScores = [];
        for (const result of queryResults) {
            if (!result.success || !Array.isArray(result.scores) || result.scores.length === 0) {
                continue;
            }
            const numericScores = result.scores.filter(Number.isFinite);
            if (numericScores.length === 0) {
                continue;
            }
            bestScores.push(Math.max(...numericScores));
        }

        if (bestScores.length === 0) {
            return 0;
        }

        const sum = bestScores.reduce((total, value) => total + value, 0);
        const avg = sum / bestScores.length;
        return Math.max(0, Math.min(1, avg));
    }

    _shouldTriggerOcrFallback(metadata, fields, documentMetadata) {
        if (!this.config.ocrFallbackEnabled) {
            return false;
        }
        if (!documentMetadata?.id) {
            return false;
        }
        if (!this.paperlessService ||
            typeof this.paperlessService.getDocumentContent !== 'function') {
            return false;
        }
        if (!metadata || !Number.isFinite(metadata.visual_confidence)) {
            return false;
        }
        if (metadata.visual_confidence >= this.config.ocrFallbackConfidenceThreshold) {
            return false;
        }
        if (!Array.isArray(fields) || fields.length === 0) {
            return false;
        }
        return true;
    }

    _sanitizeQueryText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (!normalized) {
            return '';
        }
        if (normalized.length <= this.config.ocrFallbackMaxQueryLength) {
            return normalized;
        }
        return normalized.slice(0, this.config.ocrFallbackMaxQueryLength).trim();
    }

    _generateOcrGuidedQueries(ocrText, visualQueries, fields) {
        if (!this.ocrGuidedSearch ||
            typeof this.ocrGuidedSearch._generateOcrGuidedQueries !== 'function') {
            return [];
        }

        return this.ocrGuidedSearch._generateOcrGuidedQueries(
            ocrText,
            fields,
            visualQueries
        );
    }

    async executeWithOcrFallback(visualResult, documentMetadata, options = {}) {
        const documentId = typeof documentMetadata === 'object'
            ? documentMetadata.id
            : documentMetadata;

        if (!documentId) {
            return visualResult;
        }

        const ocrGuidedSearch = this.ocrGuidedSearch;
        const result = await ocrGuidedSearch.searchWithOcrGuidance(
            visualResult,
            documentId,
            documentMetadata?.documentType || 'general',
            {
                ...options,
                documentMetadata,
                executeQueries: this._executeQueriesWithCircuitBreaker.bind(this),
                deduplicateBoundingBoxes: this._deduplicateBoundingBoxes.bind(this),
                deduplicateCandidates: this._deduplicateCandidates.bind(this),
                mergeResults: this._mergeResults.bind(this),
                calculateOverlays: this._calculateOverlays.bind(this),
                buildKValues: this._buildKValues.bind(this),
                buildDedupStats: this._buildDedupStats.bind(this),
                calculateVisualConfidence: this._calculateVisualConfidence.bind(this),
                buildMetadata: this._buildMetadata.bind(this),
                extractNewlyDiscovered: this._extractNewlyDiscovered.bind(this),
                confidenceThreshold: this.config.ocrFallbackConfidenceThreshold
            }
        );

        if (result.execution_metadata) {
            result.execution_metadata.ocr_fallback_confidence_threshold =
                this.config.ocrFallbackConfidenceThreshold;
        }

        if (result.execution_metadata?.ocr_fallback_used &&
            this.metricsCollector?.recordFallback) {
            this.metricsCollector.recordFallback({
                pipelineId: documentMetadata?.pipelineId,
                from: 'visual',
                to: 'ocr_guided_visual',
                reason: 'low_visual_confidence'
            });
        }

        return result;
    }

    /**
     * Deduplicate overlapping bounding boxes using IoU threshold
     * @private
     */
    _deduplicateBoundingBoxes(queryResults) {
        const allBoxes = [];

        // Collect all bounding boxes from successful queries
        for (const result of queryResults) {
            if (result.success && result.bounding_boxes) {
                for (let i = 0; i < result.bounding_boxes.length; i++) {
                    allBoxes.push({
                        box: result.bounding_boxes[i],
                        score: result.scores?.[i] || 0,
                        query: result.query,
                        page_number: result.page_numbers?.[i]
                    });
                }
            }
        }

        return this._deduplicateCandidates(allBoxes);
    }

    _deduplicateCandidates(candidates) {
        const allBoxes = Array.isArray(candidates) ? [...candidates] : [];

        // Sort by score (descending) for greedy deduplication
        allBoxes.sort((a, b) => b.score - a.score);

        const deduplicated = [];
        const iouThreshold = Math.max(0, this.config.iouThreshold - 0.1);

        for (const candidate of allBoxes) {
            let isDuplicate = false;

            for (const existing of deduplicated) {
                const samePage = (
                    candidate.page_number === undefined ||
                    existing.page_number === undefined ||
                    candidate.page_number === existing.page_number
                );
                if (samePage) {
                    const iou = this._calculateIoU(candidate.box, existing.box);
                    if (iou > iouThreshold) {
                        isDuplicate = true;
                        break;
                    }
                }
            }

            if (!isDuplicate) {
                deduplicated.push(candidate);
            }
        }

        return deduplicated;
    }

    /**
     * Calculate Intersection over Union (IoU) for two bounding boxes
     * @private
     */
    _calculateIoU(box1, box2) {
        // Box format: { x, y, width, height } (normalized 0-1)
        const x1_min = box1.x;
        const y1_min = box1.y;
        const x1_max = box1.x + box1.width;
        const y1_max = box1.y + box1.height;

        const x2_min = box2.x;
        const y2_min = box2.y;
        const x2_max = box2.x + box2.width;
        const y2_max = box2.y + box2.height;

        // Calculate intersection
        const intersect_x_min = Math.max(x1_min, x2_min);
        const intersect_y_min = Math.max(y1_min, y2_min);
        const intersect_x_max = Math.min(x1_max, x2_max);
        const intersect_y_max = Math.min(y1_max, y2_max);

        const intersect_width = Math.max(0, intersect_x_max - intersect_x_min);
        const intersect_height = Math.max(0, intersect_y_max - intersect_y_min);
        const intersection = intersect_width * intersect_height;

        // Calculate union
        const area1 = box1.width * box1.height;
        const area2 = box2.width * box2.height;
        const union = area1 + area2 - intersection;

        const iou = union > 0 ? intersection / union : 0;
        return Math.min(1, iou);
    }

    /**
     * Normalize overlay box format [xmin, ymin, xmax, ymax] to { x, y, width, height }
     * @private
     */
    _normalizeOverlayBox(box) {
        if (!Array.isArray(box) || box.length < 4) {
            return null;
        }

        const [xmin, ymin, xmax, ymax] = box.map(Number);
        if (![xmin, ymin, xmax, ymax].every(Number.isFinite)) {
            return null;
        }

        const maxVal = Math.max(xmin, ymin, xmax, ymax);
        const scale = maxVal > 1 ? 1000 : 1;
        const x = xmin / scale;
        const y = ymin / scale;
        const width = Math.max(0, (xmax - xmin) / scale);
        const height = Math.max(0, (ymax - ymin) / scale);

        return {
            x: Math.min(1, Math.max(0, x)),
            y: Math.min(1, Math.max(0, y)),
            width: Math.min(1, Math.max(0, width)),
            height: Math.min(1, Math.max(0, height))
        };
    }

    /**
     * Merge visual results with extraction results using confidence fusion
     * @private
     */
    _mergeResults(extractionResults, visualResults, _queries) {
        const fields = [];
        const extractedFieldsMap = new Map();

        // Index extraction results
        if (extractionResults.fields && Array.isArray(extractionResults.fields)) {
            for (const field of extractionResults.fields) {
                extractedFieldsMap.set(field.name, field);
            }
        }

        // Process visual results and merge with extraction
        for (const visualResult of visualResults) {
            const fieldName = visualResult.query.field_target;
            const visualConfidence = visualResult.score;
            const queryPaperlessField = visualResult.query?.paperlessField || null;
            const queryMappingConfidence = visualResult.query?.mappingConfidence ?? null;

            if (extractedFieldsMap.has(fieldName)) {
                // Field exists - fuse confidence scores
                const extractedField = extractedFieldsMap.get(fieldName);
                const ocrConfidence = Number.isFinite(extractedField.confidence)
                    ? extractedField.confidence
                    : 0;
                const visualValue =
                    visualResult.value ??
                    visualResult.query?.value ??
                    visualResult.query?.visual_value ??
                    extractedField.value;
                const fusionResult = this.hybridConfidenceFusion.fuseField({
                    fieldName,
                    visualConfidence,
                    ocrConfidence,
                    visualValue,
                    ocrValue: extractedField.value
                });

                fields.push({
                    ...extractedField,
                    value: fusionResult.resolved_value ?? extractedField.value,
                    confidence: fusionResult.confidence,
                    visual_confirmation: true,
                    visual_confidence: visualConfidence,
                    ocr_confidence: ocrConfidence,
                    extraction_confidence: ocrConfidence,
                    confidence_adjustment: fusionResult.confidence_adjustment,
                    confidence_base: fusionResult.base_confidence,
                    fusion_state: fusionResult.fusion_state,
                    agreement_detected: fusionResult.agreement_detected,
                    agreement_score: fusionResult.agreement_score,
                    arbitration_source: fusionResult.arbitration_source,
                    paperlessField: extractedField.paperlessField || queryPaperlessField,
                    mappingConfidence:
                        extractedField.mappingConfidence ?? queryMappingConfidence,
                    bounding_box: {
                        ...visualResult.box,
                        page_number: visualResult.page_number ?? null
                    }
                });

                // Remove from map to track processed fields
                extractedFieldsMap.delete(fieldName);
            } else {
                // Newly discovered field from visual search
                const fusionResult = this.hybridConfidenceFusion.fuseField({
                    fieldName,
                    visualConfidence,
                    ocrConfidence: 0,
                    visualValue: visualResult.value ?? null,
                    ocrValue: null
                });
                fields.push({
                    name: fieldName,
                    value: fusionResult.resolved_value, // Resolved visual value if available
                    confidence: fusionResult.confidence,
                    visual_confidence: visualConfidence,
                    ocr_confidence: 0,
                    extraction_confidence: 0,
                    confidence_adjustment: fusionResult.confidence_adjustment,
                    confidence_base: fusionResult.base_confidence,
                    fusion_state: fusionResult.fusion_state,
                    agreement_detected: fusionResult.agreement_detected,
                    agreement_score: fusionResult.agreement_score,
                    arbitration_source: fusionResult.arbitration_source,
                    paperlessField: queryPaperlessField,
                    mappingConfidence: queryMappingConfidence,
                    newly_discovered: true,
                    bounding_box: {
                        ...visualResult.box,
                        page_number: visualResult.page_number ?? null
                    }
                });
            }
        }

        // Add remaining extracted fields (no visual confirmation)
        for (const [_fieldName, field] of extractedFieldsMap) {
            fields.push({
                ...field,
                visual_confirmation: false
            });
        }

        return fields;
    }

    _summarizeFusionStates(fields) {
        return this.hybridConfidenceFusion.summarize(fields);
    }

    _recordHybridFusionTelemetry(documentMetadata, fusionSummary, fields) {
        if (!fusionSummary || fusionSummary.total_fused_fields === 0) {
            return;
        }

        logger.info({
            event: 'hybrid_confidence_fusion_stats',
            documentId: documentMetadata?.id,
            documentType: documentMetadata?.documentType || 'unknown',
            totalFusedFields: fusionSummary.total_fused_fields,
            states: fusionSummary.states,
            averageConfidence: fusionSummary.average_confidence,
            averageAdjustment: fusionSummary.average_adjustment
        });

        if (!this.metricsCollector?.recordHybridConfidenceFusion) {
            return;
        }

        const docType = documentMetadata?.documentType || 'unknown';
        const list = Array.isArray(fields) ? fields : [];
        for (const field of list) {
            if (!field?.fusion_state) {
                continue;
            }
            this.metricsCollector.recordHybridConfidenceFusion(
                docType,
                field.fusion_state,
                field.confidence
            );
        }
    }

    /**
     * Calculate overlay positions for UI rendering
     * @private
     */
    _calculateOverlays(visualResults) {
        return visualResults.map(result => ({
            field_name: result.query.field_target,
            page_number: result.page_number ?? null,
            position: {
                x: result.box.x,
                y: result.box.y,
                width: result.box.width,
                height: result.box.height
            },
            confidence: result.score,
            query_type: result.query.expected_element_type
        }));
    }

    /**
     * Extract newly discovered fields from merged results
     * @private
     */
    _extractNewlyDiscovered(fields) {
        return fields.filter(f => f.newly_discovered === true);
    }

    /**
     * Build execution metadata
     * @private
     */
    _buildMetadata(queryResults, startTime, extras = {}) {
        const results = Array.isArray(queryResults) ? queryResults : [];
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const timeouts = results.filter(r => r.isTimeout).length;
        const totalLatency = results.reduce((sum, r) => sum + (r.latency || 0), 0);
        const errorStatus = results.find(r => r.error_status)?.error_status || null;
        const errorType = results.find(r => r.error_type)?.error_type || null;
        const kValues = extras.kValues || this._buildKValues(results);
        const kSummary = this._buildKSummary(kValues);
        const dedupStats = extras.dedupStats || {};
        const computedConfidence = Number.isFinite(extras.visualConfidence)
            ? Math.max(0, Math.min(1, extras.visualConfidence))
            : this._calculateVisualConfidence(results);
        const fusionSummary = extras.fusionSummary || null;

        return {
            total_queries_executed: results.length,
            successful_queries: successful,
            failed_queries: failed,
            timeout_queries: timeouts,
            circuit_breaker_state: this.circuitBreaker.state,
            total_latency_ms: totalLatency,
            average_query_latency_ms: results.length > 0 ? totalLatency / results.length : 0,
            visual_confirmation_rate: successful / Math.max(1, results.length),
            execution_duration_ms: Date.now() - startTime,
            error_status: errorStatus,
            error_type: errorType,
            visual_confidence: computedConfidence,
            k_values: kValues,
            k_summary: kSummary,
            raw_hit_count: dedupStats.raw_hit_count || 0,
            deduplicated_count: dedupStats.deduplicated_count || 0,
            dedup_removed_count: dedupStats.dedup_removed_count || 0,
            hybrid_confidence_fusion: fusionSummary
        };
    }

    /**
     * Build fallback result (extraction-only)
     * @private
     */
    _buildFallbackResult(extractionResults, startTime, reason, error = null) {
        const fields = extractionResults.fields || [];

        return {
            fields: fields.map(f => ({ ...f, visual_confirmation: false })),
            newly_discovered_fields: [],
            overlays: [],
            execution_metadata: {
                total_queries_executed: 0,
                successful_queries: 0,
                failed_queries: 0,
                timeout_queries: 0,
                circuit_breaker_state: this.circuitBreaker.state,
                total_latency_ms: 0,
                average_query_latency_ms: 0,
                visual_confirmation_rate: 0,
                execution_duration_ms: Date.now() - startTime,
                fallback: true,
                fallback_reason: reason,
                error: error?.message,
                error_status: error?.status || null,
                error_type: error?.type || null,
                hybrid_confidence_fusion: this._summarizeFusionStates(fields)
            }
        };
    }

    /**
     * Update statistics
     * @private
     */
    _updateStats(success, isTimeout, latency) {
        this.stats.totalQueriesExecuted += 1;

        if (success) {
            this.stats.successfulQueries += 1;
        } else {
            this.stats.failedQueries += 1;
            if (isTimeout) {
                this.stats.timeoutQueries += 1;
            }
        }

        this.stats.totalLatencyMs += latency;
        this.stats.averageLatencyMs =
            this.stats.totalLatencyMs / this.stats.totalQueriesExecuted;
    }

    /**
     * Get current statistics
     */
    getStats() {
        return {
            ...this.stats,
            circuitBreakerStats: this.circuitBreaker.stats
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalQueriesExecuted: 0,
            successfulQueries: 0,
            failedQueries: 0,
            timeoutQueries: 0,
            circuitBreakerRejections: 0,
            totalLatencyMs: 0,
            averageLatencyMs: 0
        };
    }

    /**
     * Get circuit breaker state
     */
    getCircuitBreakerState() {
        return this.circuitBreaker.state;
    }
}

// Export singleton instance factory
module.exports = {
    VisualQueryExecutor,
    BASE_K_VALUES,
    DEFAULT_CONFIG
};
