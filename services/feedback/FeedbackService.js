/**
 * FeedbackService.js
 * * Handles user feedback collection and quality analytics for Phase 5.
 * Tracks extraction accuracy and model performance based on user corrections.
 */

const logger = require('../logger');
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

module.exports = new FeedbackService();
