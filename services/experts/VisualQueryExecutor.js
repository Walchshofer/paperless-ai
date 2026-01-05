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
const { CircuitBreaker, CircuitState } = require('./CircuitBreaker');

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
    maxRetries: 3,               // Retry failed queries up to 3 times
    initialBackoff: 100,         // Initial backoff: 100ms
    backoffMultiplier: 2,        // Exponential backoff: 100, 200, 400
    iouThreshold: 0.7,           // IoU threshold for deduplication
    extractionWeight: 0.6,       // Confidence fusion: extraction weight
    visualWeight: 0.4,           // Confidence fusion: visual weight
    failureThreshold: 3,         // Circuit breaker failure threshold
    cooldownPeriod: 30000        // Circuit breaker cooldown: 30s
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
        this.config = {
            ...DEFAULT_CONFIG,
            ...options
        };

        // Initialize circuit breaker for sidecar protection
        this.circuitBreaker = new CircuitBreaker('visual-rag-sidecar', {
            failureThreshold: this.config.failureThreshold,
            cooldownPeriod: this.config.cooldownPeriod,
            timeout: this.config.timeoutBudget,
            hardTimeout: this.config.hardTimeout,
            maxRetries: this.config.maxRetries,
            initialBackoff: this.config.initialBackoff,
            backoffMultiplier: this.config.backoffMultiplier
        });

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

            return this._buildFallbackResult(extractionResults, startTime, 'circuit_breaker_open');
        }

        // If no queries or no image, return extraction-only results
        if (!visualQueries || visualQueries.length === 0) {
            logger.info({
                event: 'visual_query_execution_skipped',
                reason: 'no_queries',
                documentId: documentMetadata.id
            });

            return this._buildFallbackResult(extractionResults, startTime, 'no_queries');
        }

        // Require a document image for visual search; otherwise degrade gracefully
        if (!documentImage) {
            logger.info({
                event: 'visual_query_execution_skipped',
                reason: 'no_image',
                documentId: documentMetadata.id
            });

            return this._buildFallbackResult(extractionResults, startTime, 'no_image');
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

            // Calculate overlay positions
            const overlays = this._calculateOverlays(dedupedResults);

            // Build metadata
            const metadata = this._buildMetadata(queryResults, startTime);

            logger.info({
                event: 'visual_query_execution_complete',
                documentId: documentMetadata.id,
                successfulQueries: metadata.successful_queries,
                failedQueries: metadata.failed_queries,
                durationMs: Date.now() - startTime
            });

            return {
                fields: mergedFields,
                newly_discovered_fields: this._extractNewlyDiscovered(mergedFields),
                overlays,
                execution_metadata: metadata
            };

        } catch (error) {
            logger.error({
                event: 'visual_query_execution_failed',
                documentId: documentMetadata.id,
                error: error.message,
                stack: error.stack
            });

            // Graceful degradation: return extraction-only results
            return this._buildFallbackResult(extractionResults, startTime, 'error', error);
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

        try {
            // Calculate dynamic K for this query
            const k = this._calculateDynamicK(query);

            // Execute via circuit breaker
            const cbResult = await this.circuitBreaker.execute(async () => {    
                return await this._executeVisualSearch(
                    query.question,
                    documentImage,
                    k,
                    documentMetadata
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
                bounding_boxes: result.bounding_boxes || [],
                scores: result.scores || [],
                page_numbers: result.page_numbers || [],
                latency
            };

        } catch (error) {
            const latency = Date.now() - startTime;
            const isTimeout = error.message?.includes('timeout') || latency >= this.config.hardTimeout;

            this._updateStats(false, isTimeout, latency);

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
                error: error.message,
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
    async _executeVisualSearch(question, documentImage, k, documentMetadata) {
        logger.debug({
            event: 'visual_search_call',
            question,
            k,
            documentId: documentMetadata.id
        });

        const response = await this.visualSearchClient.search(question, { k });

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
        const baseK = BASE_K_VALUES[query.expected_element_type] || 3;
        const confidenceFactor = 1 + (1 - query.confidence);
        const rarityFactor = 1 + query.rarity_factor;

        const dynamicK = baseK * confidenceFactor * rarityFactor;

        return Math.max(1, Math.round(dynamicK));  // At least 1, rounded
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

        // Sort by score (descending) for greedy deduplication
        allBoxes.sort((a, b) => b.score - a.score);

        const deduplicated = [];
        const iouThreshold = Math.max(0, this.config.iouThreshold - 0.1); // allow small tolerance

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
     * Normalize overlay box format [ymin, xmin, ymax, xmax] to { x, y, width, height }
     * @private
     */
    _normalizeOverlayBox(box) {
        if (!Array.isArray(box) || box.length < 4) {
            return null;
        }

        const [ymin, xmin, ymax, xmax] = box.map(Number);
        if (![ymin, xmin, ymax, xmax].every(Number.isFinite)) {
            return null;
        }

        const maxVal = Math.max(ymin, xmin, ymax, xmax);
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
    _mergeResults(extractionResults, visualResults, queries) {
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

            if (extractedFieldsMap.has(fieldName)) {
                // Field exists - fuse confidence scores
                const extractedField = extractedFieldsMap.get(fieldName);
                const extractionConfidence = extractedField.confidence;

                const fusedConfidence =
                    extractionConfidence * this.config.extractionWeight +
                    visualConfidence * this.config.visualWeight;

                fields.push({
                    ...extractedField,
                    confidence: fusedConfidence,
                    visual_confirmation: true,
                    visual_confidence: visualConfidence,
                    extraction_confidence: extractionConfidence,
                    bounding_box: {
                        ...visualResult.box,
                        page_number: visualResult.page_number ?? null
                    }
                });

                // Remove from map to track processed fields
                extractedFieldsMap.delete(fieldName);
            } else {
                // Newly discovered field from visual search
                fields.push({
                    name: fieldName,
                    value: null,  // Value extraction happens in next stage     
                    confidence: visualConfidence,
                    visual_confidence: visualConfidence,
                    newly_discovered: true,
                    bounding_box: {
                        ...visualResult.box,
                        page_number: visualResult.page_number ?? null
                    }
                });
            }
        }

        // Add remaining extracted fields (no visual confirmation)
        for (const [fieldName, field] of extractedFieldsMap) {
            fields.push({
                ...field,
                visual_confirmation: false
            });
        }

        return fields;
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
    _buildMetadata(queryResults, startTime) {
        const successful = queryResults.filter(r => r.success).length;
        const failed = queryResults.filter(r => !r.success).length;
        const timeouts = queryResults.filter(r => r.isTimeout).length;
        const totalLatency = queryResults.reduce((sum, r) => sum + (r.latency || 0), 0);

        return {
            total_queries_executed: queryResults.length,
            successful_queries: successful,
            failed_queries: failed,
            timeout_queries: timeouts,
            circuit_breaker_state: this.circuitBreaker.state,
            total_latency_ms: totalLatency,
            average_query_latency_ms: queryResults.length > 0 ? totalLatency / queryResults.length : 0,
            visual_confirmation_rate: successful / Math.max(1, queryResults.length),
            execution_duration_ms: Date.now() - startTime
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
                error: error?.message
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
