/**
 * Visual Query Analytics API Routes
 *
 * Provides endpoints for visual query performance metrics:
 * - GET /api/analytics/visual-queries - Get snapshot of analytics
 * - GET /api/analytics/visual-queries/csv - Export analytics to CSV
 * - GET /api/analytics/visual-queries/stream - SSE endpoint for real-time updates
 *
 * @module routes/api/analytics
 */

const express = require('express');
const router = express.Router();
const visualQueryAnalyticsService = require('../../services/analytics/VisualQueryAnalyticsService');
const { authenticateApi, requireAdmin } = require('../../middleware/auth');
const logger = require('../../services/logger');

/**
 * @swagger
 * /api/analytics/visual-queries:
 *   get:
 *     summary: Get visual query analytics snapshot
 *     description: |
 *       Returns aggregated analytics for visual queries including latency percentiles,
 *       accuracy by domain, fallback rates, and top queries.
 *     tags: [Analytics, Visual RAG]
 *     parameters:
 *       - in: query
 *         name: windowHours
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 168
 *           default: 24
 *         description: Time window for analytics (1-168 hours)
 *     responses:
 *       200:
 *         description: Analytics snapshot
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                     windowHours:
 *                       type: integer
 *                     counts:
 *                       type: object
 *                       properties:
 *                         totalQueries:
 *                           type: integer
 *                         successfulQueries:
 *                           type: integer
 *                         failedQueries:
 *                           type: integer
 *                     latency:
 *                       type: object
 *                       properties:
 *                         p50Ms:
 *                           type: number
 *                         p95Ms:
 *                           type: number
 *                         p99Ms:
 *                           type: number
 *                     errorRate:
 *                       type: number
 *                     accuracyByDomain:
 *                       type: object
 *                     fallbackRates:
 *                       type: object
 *                     topQueries:
 *                       type: array
 *                     trend:
 *                       type: array
 *       500:
 *         description: Failed to retrieve analytics
 */
router.get('/visual-queries', authenticateApi, requireAdmin, (req, res) => {
  try {
    const windowHours = parseInt(req.query.windowHours, 10) || 24;
    const snapshot = visualQueryAnalyticsService.getSnapshot({ windowHours });

    res.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    logger.error('[Analytics API] Failed to get snapshot:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/analytics/visual-queries/csv:
 *   get:
 *     summary: Export visual query analytics to CSV
 *     description: |
 *       Downloads analytics data as a CSV file for external analysis.
 *     tags: [Analytics, Visual RAG]
 *     parameters:
 *       - in: query
 *         name: windowHours
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 168
 *           default: 24
 *         description: Time window for analytics (1-168 hours)
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       500:
 *         description: Failed to generate CSV
 */
router.get('/visual-queries/csv', authenticateApi, requireAdmin, (req, res) => {
  try {
    const windowHours = parseInt(req.query.windowHours, 10) || 24;
    const snapshot = visualQueryAnalyticsService.getSnapshot({ windowHours });
    const csv = visualQueryAnalyticsService.buildCsv(snapshot);

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const filename = `visual-query-analytics-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    logger.error('[Analytics API] Failed to generate CSV:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/analytics/visual-queries/stream:
 *   get:
 *     summary: SSE stream for real-time analytics updates
 *     description: |
 *       Server-Sent Events endpoint that pushes analytics updates every 5 seconds.
 *       Use this for real-time dashboard updates.
 *     tags: [Analytics, Visual RAG]
 *     parameters:
 *       - in: query
 *         name: windowHours
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 168
 *           default: 24
 *         description: Time window for analytics (1-168 hours)
 *     responses:
 *       200:
 *         description: SSE stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
router.get('/visual-queries/stream', authenticateApi, requireAdmin, (req, res) => {
  const windowHours = parseInt(req.query.windowHours, 10) || 24;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial data
  const sendSnapshot = () => {
    try {
      const snapshot = visualQueryAnalyticsService.getSnapshot({ windowHours });
      res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    } catch (error) {
      logger.error('[Analytics API] SSE snapshot error:', error.message);
    }
  };

  sendSnapshot();

  // Send updates every 5 seconds
  const interval = setInterval(sendSnapshot, 5000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
});

/**
 * @swagger
 * /api/analytics/visual-queries/record:
 *   post:
 *     summary: Record a visual query event (internal)
 *     description: |
 *       Internal endpoint for recording query events. Called by visual-rag search handlers.
 *     tags: [Analytics, Visual RAG]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latencyMs
 *             properties:
 *               query:
 *                 type: string
 *               domain:
 *                 type: string
 *                 enum: [financial, medical, legal, general]
 *               success:
 *                 type: boolean
 *               latencyMs:
 *                 type: number
 *               errorType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event recorded
 *       400:
 *         description: Invalid event data
 */
router.post('/visual-queries/record', authenticateApi, (req, res) => {
  try {
    const { query, domain, success, latencyMs, errorType } = req.body;

    const recorded = visualQueryAnalyticsService.recordQueryEvent({
      query,
      domain,
      success,
      latencyMs,
      errorType
    });

    if (!recorded) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event data (latencyMs required and must be non-negative)'
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[Analytics API] Failed to record event:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/analytics/visual-queries/fallback:
 *   post:
 *     summary: Record a fallback event (internal)
 *     description: |
 *       Internal endpoint for recording fallback events when visual search
 *       falls back to text or OCR.
 *     tags: [Analytics, Visual RAG]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - from
 *               - to
 *             properties:
 *               from:
 *                 type: string
 *                 enum: [visual, text, ocr]
 *               to:
 *                 type: string
 *                 enum: [visual, text, ocr]
 *               reason:
 *                 type: string
 *               domain:
 *                 type: string
 *     responses:
 *       200:
 *         description: Fallback event recorded
 *       400:
 *         description: Invalid fallback data
 */
router.post('/visual-queries/fallback', authenticateApi, (req, res) => {
  try {
    const { from, to, reason, domain } = req.body;

    const recorded = visualQueryAnalyticsService.recordFallbackEvent({
      from,
      to,
      reason,
      domain
    });

    if (!recorded) {
      return res.status(400).json({
        success: false,
        error: 'Invalid fallback data (from and to are required)'
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[Analytics API] Failed to record fallback:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
