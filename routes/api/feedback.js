/**
 * Feedback API Routes
 *
 * Handles user feedback submission and analytics retrieval.
 * Connected to FeedbackService for storage and analysis.
 *
 * Endpoints:
 * - POST /api/feedback - Submit feedback for a document
 * - GET /api/feedback/analytics - Get aggregated feedback analytics
 */

const express = require('express');
const router = express.Router();
const { authenticateApi, requireAdmin } = require('../../middleware/auth');
const logger = require('../../services/logger');

// User feedback routes require authentication
router.post('/events', authenticateApi, async (req, res) => {
    try {
        const { doc_id, user_id, event_type, field_name, original_value, corrected_value, context } = req.body;
        if (!doc_id || !event_type) return res.status(400).json({ success: false, error: 'doc_id and event_type are required' });

        const inserted = await require('../../services/documentModel').insertFeedback({
            doc_id,
            user_id: user_id || null,
            event_type,
            field_name: field_name || null,
            original_value: original_value || null,
            corrected_value: corrected_value || null,
            context: context || {}
        });

        res.json({ success: true, inserted });
    } catch (err) {
        logger.error({ event: 'feedback_event_ingest_error', error: err.message });
        res.status(500).json({ success: false, error: 'Failed to ingest feedback event' });
    }
});

// Internal: get pending feedback events for Bias Engine
router.get('/pending', authenticateApi, requireAdmin, async (req, res) => {
    try {
        // TODO: protect with service auth
        const rows = await require('../../services/documentModel').getPendingFeedback();
        res.json({ success: true, pending: rows });
    } catch (err) {
        logger.error({ event: 'feedback_pending_error', error: err.message });
        res.status(500).json({ success: false, error: 'Failed to fetch pending feedback' });
    }
});

// Internal: mark events processed
router.post('/process', authenticateApi, requireAdmin, async (req, res) => {
    try {
        // TODO: protect with service auth
        const { ids } = req.body;
        if (!Array.isArray(ids)) return res.status(400).json({ success: false, error: 'ids array is required' });
        const count = await require('../../services/documentModel').markFeedbackProcessed(ids);
        res.json({ success: true, processed: count });
    } catch (err) {
        logger.error({ event: 'feedback_process_error', error: err.message });
        res.status(500).json({ success: false, error: 'Failed to mark feedback as processed' });
    }
});
const feedbackService = require('../../services/feedback/FeedbackService');

/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Submit feedback for document extraction
 *     description: |
 *       Records user feedback about extraction accuracy for a processed document.
 *       Supports ratings, accuracy scores, field corrections, and comments.
 *     tags: [Feedback]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *               - rating
 *             properties:
 *               documentId:
 *                 type: string
 *                 description: Paperless document ID
 *               pipelineId:
 *                 type: string
 *                 description: Pipeline that processed the document
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Overall satisfaction rating (1-5 stars)
 *               accuracyScore:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 description: Estimated extraction accuracy (0.0-1.0)
 *               corrections:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of field names that had errors
 *               comments:
 *                 type: string
 *                 description: Free-form feedback comments
 *     responses:
 *       200:
 *         description: Feedback submitted successfully
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateApi, async (req, res) => {
    try {
        const { documentId, pipelineId, rating, accuracyScore, corrections, comments, metadata } = req.body;

        // Validate required fields
        if (!documentId) {
            return res.status(400).json({
                success: false,
                error: 'documentId is required'
            });
        }

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: 'rating must be between 1 and 5'
            });
        }

        // Submit to FeedbackService
        const result = await feedbackService.submitFeedback(documentId, {
            pipelineId: pipelineId || 'unknown',
            rating: parseInt(rating, 10),
            accuracyScore: accuracyScore !== undefined ? parseFloat(accuracyScore) : rating / 5,
            corrections: corrections || [],
            comments: comments || '',
            metadata: metadata || {}
        });

        logger.info({
            event: 'feedback_api_success',
            documentId,
            rating
        });

        res.json({
            success: true,
            message: 'Feedback submitted successfully',
            feedbackId: result.feedbackId
        });

    } catch (error) {
        logger.error({
            event: 'feedback_api_error',
            error: error.message
        });

        res.status(500).json({
            success: false,
            error: 'Failed to submit feedback'
        });
    }
});

/**
 * @swagger
 * /api/feedback/analytics:
 *   get:
 *     summary: Get feedback analytics
 *     description: Returns aggregated statistics about user feedback
 *     tags: [Feedback]
 *     responses:
 *       200:
 *         description: Analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 analytics:
 *                   type: object
 *                   properties:
 *                     totalFeedback:
 *                       type: integer
 *                     averageRating:
 *                       type: number
 *                     averageAccuracy:
 *                       type: number
 *                     pipelinePerformance:
 *                       type: object
 *                     topCorrectionFields:
 *                       type: object
 */
router.get('/analytics', authenticateApi, requireAdmin, async (req, res) => {
    try {
        const analytics = await feedbackService.getAnalytics();

        res.json({
            success: true,
            analytics
        });

    } catch (error) {
        logger.error({
            event: 'feedback_analytics_error',
            error: error.message
        });

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve analytics'
        });
    }
});

/**
 * POST /api/feedback/field-vote
 * Body: { documentId: number, fieldId: string, vote: 'up'|'down' }
 * Requires authenticated user (req.user.username)
 */
router.post('/field-vote', authenticateApi, async (req, res) => {
    try {
        const { documentId, fieldId, vote } = req.body;

        if (!req.user || !req.user.username) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        if (!documentId || !fieldId || !['up', 'down'].includes(vote)) {
            return res.status(400).json({ success: false, error: 'documentId, fieldId and vote (up|down) are required' });
        }

        const feedbackPayload = {
            document_id: documentId,
            user_id: req.user?.id || null,
            event_type: 'field_vote',
            field_name: fieldId,
            original_value: null,
            corrected_value: vote,
            context: { username: req.user.username, vote }
        };

        const inserted = await require('../../services/documentModel').insertFeedback(feedbackPayload);

        logger.info({ event: 'field_vote', documentId, fieldId, username: req.user.username, vote });

        res.json({ success: true, inserted });
    } catch (error) {
        logger.error({ event: 'field_vote_error', error: error.message });
        res.status(500).json({ success: false, error: 'Failed to record field vote' });
    }
});

module.exports = router;
