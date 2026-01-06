/**
 * FeedbackService.js
 * * Handles user feedback collection and quality analytics for Phase 5.
 * Tracks extraction accuracy and model performance based on user corrections.
 */

const logger = require('../logger');

const documentModel = require('../../models/document');
const path = require('path');
const fs = require('fs').promises;
const { metricsCollector } = require('../metrics/PrometheusMetrics');

class FeedbackService {
    constructor(options = {}) {
        this.feedbackDir = options.feedbackDir || path.join(process.cwd(), 'data', 'feedback');
        this._initialized = false;
    }

    /**
     * Ensure the feedback storage directory exists
     */
    async _init() {
        if (this._initialized) return;
        try {
            await fs.mkdir(this.feedbackDir, { recursive: true });
            this._initialized = true;
        } catch (err) {
            logger.error(`[FeedbackService] Initialization failed: ${err.message}`);
        }
    }

    /**
     * Records user feedback for a processing result
     * @param {string} documentId - The Paperless document ID
     * @param {Object} feedback - { rating, accuracyScore, corrections, comments, pipelineId }
     */



    async submitFeedback(documentId, feedback) {
        await this._init();

        const record = {
            documentId,
            timestamp: new Date().toISOString(),
            pipelineId: feedback.pipelineId,
            rating: feedback.rating, // 1-5
            accuracyScore: feedback.accuracyScore, // 0.0-1.0
            corrections: feedback.corrections || [], // Array of fields that were wrong
            comments: feedback.comments || '',
            metadata: feedback.metadata || {}
        };

        try {
            const fileName = `feedback_${documentId}_${Date.now()}.json`;
            const filePath = path.join(this.feedbackDir, fileName);
            
            await fs.writeFile(filePath, JSON.stringify(record, null, 2));

            // Persist as feedback_event in DB (best-effort)
            try {
                await documentModel.insertFeedback({
                    doc_id: parseInt(documentId, 10),
                    user_id: null,
                    event_type: 'correction',
                    field_name: 'general_feedback',
                    original_value: null,
                    corrected_value: JSON.stringify({ rating: record.rating, accuracyScore: record.accuracyScore, corrections: record.corrections }),
                    context: JSON.stringify({ pipelineId: record.pipelineId, comments: record.comments, metadata: record.metadata })
                });
            } catch (err) {
                logger.error({ event: 'feedback_db_insert_failed', error: err.message, documentId });
            }

            logger.info({
                event: 'user_feedback_submitted',
                documentId,
                pipelineId: feedback.pipelineId,
                rating: feedback.rating
            });
            if (metricsCollector?.recordFeedback) {
                metricsCollector.recordFeedback({
                    pipelineId: feedback.pipelineId,
                    accuracyScore: record.accuracyScore,
                    corrections: record.corrections
                });
            }

            return { success: true, feedbackId: fileName };
        } catch (err) {
            logger.error(`[FeedbackService] Failed to save feedback: ${err.message}`);
            throw err;
        }
    }

    /**
     * Retrieves analytics for Phase 5 dashboards
     */
    async getAnalytics() {
        await this._init();
        try {
            const files = await fs.readdir(this.feedbackDir);
            const records = [];

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs.readFile(path.join(this.feedbackDir, file), 'utf8');
                    records.push(JSON.parse(content));
                }
            }

            if (records.length === 0) return this._emptyStats();

            const stats = {
                totalFeedback: records.length,
                averageRating: records.reduce((acc, r) => acc + r.rating, 0) / records.length,
                averageAccuracy: records.reduce((acc, r) => acc + r.accuracyScore, 0) / records.length,
                pipelinePerformance: {},
                topCorrectionFields: {}
            };

            // Aggregate by pipeline and track common corrections
            records.forEach(r => {
                const pId = r.pipelineId || 'unknown';
                if (!stats.pipelinePerformance[pId]) {
                    stats.pipelinePerformance[pId] = { count: 0, sumRating: 0 };
                }
                stats.pipelinePerformance[pId].count++;
                stats.pipelinePerformance[pId].sumRating += r.rating;

                r.corrections.forEach(field => {
                    stats.topCorrectionFields[field] = (stats.topCorrectionFields[field] || 0) + 1;
                });
            });

            return stats;
        } catch (err) {
            logger.error(`[FeedbackService] Analytics failed: ${err.message}`);
            return this._emptyStats();
        }
    }

    _emptyStats() {
        return {
            totalFeedback: 0,
            averageRating: 0,
            averageAccuracy: 0,
            pipelinePerformance: {},
            topCorrectionFields: {}
        };
    }
}

// Record granular feedback (field-level & visual annotations)
FeedbackService.prototype.recordGranularFeedback = async function(documentId, feedbackEvents = [], options = {}) {
    // options: { transactional: false, requestId: string }
    const start = Date.now();
    const requestId = options.requestId || null;
    const results = { inserted: [], overlays: [], errors: [] };

    try {
        // Lazy import to avoid circular deps where tests may not have pg available
        const visualOverlayRepository = require('../visual-rag/VisualOverlayRepository');
        const { metricsCollector } = require('../metrics/PrometheusMetrics');

        for (const evt of feedbackEvents) {
            try {
                // Normalize event shape
                const eventType = evt.type || evt.event_type || 'correction';
                const fieldName = evt.field || evt.field_name || null;
                const originalValue = evt.original || evt.original_value || null;
                const correctedValue = evt.corrected || evt.corrected_value || null;
                const context = evt.context || evt.meta || evt || {};

                // If visual annotation, store in visual_overlays
                if (eventType === 'annotation' || (context && context.bbox)) {
                    // bbox expected as [x,y,w,h] or {bbox:[]}
                    const bbox = Array.isArray(context.bbox) ? context.bbox : (Array.isArray(evt.bbox) ? evt.bbox : null);
                    const page = context.page || evt.page || 1;
                    const overlayData = {
                        label: fieldName || (context.label || 'annotation'),
                        box: bbox || null,
                        metadata: context
                    };
                    try {
                        const saved = await visualOverlayRepository.saveOverlay(Number(documentId), page, overlayData, overlayData.label, null);
                        results.overlays.push(saved);
                    } catch (ovErr) {
                        logger.error('visual_overlay_save_failed', { requestId, documentId, error: ovErr.message });
                        results.errors.push({ type: 'overlay_save_failed', error: ovErr.message });
                        if (options.transactional) throw ovErr;
                    }
                }

                // Insert feedback event (best-effort)
                try {
                    const inserted = await require('../../models/document').insertFeedback({
                        document_id: Number(documentId),
                        user_id: evt.user_id || null,
                        event_type: eventType,
                        field_name: fieldName,
                        original_value: originalValue ? JSON.stringify(originalValue) : null,
                        corrected_value: correctedValue ? JSON.stringify(correctedValue) : null,
                        context: context ? JSON.stringify(context) : null
                    });
                    results.inserted.push(inserted);
                } catch (insErr) {
                    logger.error('feedback_db_insert_failed', { requestId, documentId, error: insErr.message });
                    results.errors.push({ type: 'feedback_db_insert_failed', error: insErr.message });
                    if (options.transactional) throw insErr;
                }

                // Metrics: record user correction count
                try {
                    if (metricsCollector?.recordVisualConfirmationRate) {
                        // Placeholder usage - increment a counter indirectly
                        metricsCollector.userCorrectionRate && metricsCollector.userCorrectionRate.labels && metricsCollector.userCorrectionRate.set(1);
                    }
                } catch (mErr) {
                    logger.debug('metrics_record_feedback_failed', { requestId, error: mErr.message });
                }
            } catch (evtErr) {
                logger.error('feedback_event_processing_error', { requestId, documentId, error: evtErr.message });
                results.errors.push({ type: 'event_processing_failed', error: evtErr.message });
            }
        }

        const duration = Date.now() - start;
        if (metricsCollector && metricsCollector.recordStageLatency) {
            metricsCollector.recordStageLatency('feedback_ingest', 'integration', duration);
        }

        logger.info('feedback_ingest_completed', { requestId, documentId, inserted: results.inserted.length, overlays: results.overlays.length, duration });
        return results;
    } catch (err) {
        logger.error('recordGranularFeedback_failed', { requestId, documentId, error: err.message });
        return { inserted: [], overlays: [], errors: [{ type: 'fatal', error: err.message }] };
    }
};

module.exports = new FeedbackService();
