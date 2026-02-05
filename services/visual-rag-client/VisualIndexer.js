/**
 * VisualIndexer.js
 *
 * Universal visual indexing service for Qdrant visual_pages.
 * Handles page image validation, sidecar indexing, and telemetry.
 */

const logger = require('../logger');
const { metricsCollector } = require('../metrics/PrometheusMetrics');
const { visualSearchClient } = require('./VisualSearchClient');

class VisualIndexer {
    constructor(options = {}) {
        this.visualSearchClient =
            options.visualSearchClient || visualSearchClient;
        this.metricsCollector =
            options.metricsCollector || metricsCollector || null;
    }

    /**
     * Index all pages for a document in Qdrant visual_pages.
     * @param {number} documentId
     * @param {Array<string|Object>} pageImages
     * @param {Object} metadata
     * @returns {Promise<Object>}
     */
    async indexDocument(documentId, pageImages, metadata = {}) {
        const startTime = Date.now();
        const normalizedImages = await this._embedPages(pageImages);
        const normalizedMetadata = this._normalizeMetadata(metadata);
        const upsertResult = await this._upsertToQdrant(
            documentId,
            normalizedImages,
            normalizedMetadata
        );

        const indexingLatencyMs = Date.now() - startTime;
        const pagesIndexed = normalizedImages.length;
        const perPageLatencyMs = pagesIndexed > 0
            ? indexingLatencyMs / pagesIndexed
            : indexingLatencyMs;

        if (this.metricsCollector?.recordStageLatency) {
            this.metricsCollector.recordStageLatency(
                'visual_indexing',
                'ingestion',
                indexingLatencyMs
            );
        }

        logger.info({
            event: 'visual_indexing_stats',
            documentId,
            pagesIndexed,
            indexingLatencyMs,
            perPageLatencyMs: Number(perPageLatencyMs.toFixed(2))
        });

        return {
            ...upsertResult,
            pagesIndexed,
            indexingLatencyMs,
            perPageLatencyMs: Number(perPageLatencyMs.toFixed(2))
        };
    }

    /**
     * Validate/normalize page images before sidecar embedding.
     * @param {Array<string|Object>} pageImages
     * @returns {Promise<string[]>}
     */
    async _embedPages(pageImages) {
        if (!Array.isArray(pageImages) || pageImages.length === 0) {
            throw new Error(
                'Visual indexing requires at least one page image'
            );
        }

        const normalized = [];
        for (const image of pageImages) {
            const value = typeof image === 'string'
                ? image
                : image?.base64;
            if (typeof value === 'string' && value.trim().length > 0) {
                normalized.push(value);
            }
        }

        if (normalized.length === 0) {
            throw new Error('No valid page images supplied for indexing');
        }

        return normalized;
    }

    /**
     * Send images to sidecar for ColQwen3 embedding + Qdrant upsert.
     * @param {number} documentId
     * @param {string[]} embeddings
     * @param {Object} metadata
     * @returns {Promise<Object>}
     */
    async _upsertToQdrant(documentId, embeddings, metadata) {
        return this.visualSearchClient.indexDocument(
            documentId,
            null,
            metadata,
            embeddings
        );
    }

    _normalizeMetadata(metadata = {}) {
        const normalized = { ...metadata };
        const domain = typeof normalized.domain === 'string'
            ? normalized.domain.trim().toLowerCase()
            : '';
        normalized.domain = domain || 'general';

        const correspondentId = this._toInteger(
            normalized.correspondent_id ?? normalized.correspondent
        );
        if (correspondentId !== null) {
            normalized.correspondent_id = correspondentId;
        }

        const tagSource = normalized.tag_ids ?? normalized.tags;
        const tagIds = this._normalizeTagIds(tagSource);
        if (tagIds.length > 0) {
            normalized.tag_ids = tagIds;
        }

        if (!normalized.indexed_at) {
            normalized.indexed_at = new Date().toISOString();
        }

        return normalized;
    }

    _normalizeTagIds(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value
            .map(v => this._toInteger(v))
            .filter(v => Number.isInteger(v) && v >= 0);
    }

    _toInteger(value) {
        if (typeof value === 'number' && Number.isInteger(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim() !== '') {
            const parsed = Number.parseInt(value, 10);
            if (Number.isInteger(parsed)) {
                return parsed;
            }
        }
        return null;
    }
}

const visualIndexer = new VisualIndexer();

module.exports = {
    VisualIndexer,
    visualIndexer
};
