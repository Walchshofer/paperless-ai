/**
 * Analytics View Routes
 *
 * Provides SSR pages for analytics dashboards:
 * - GET /analytics/visual-queries - Visual Query Analytics Dashboard
 *
 * @module routes/analytics
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const visualQueryAnalyticsService = require('../services/analytics/VisualQueryAnalyticsService');
const logger = require('../services/logger');
const packageJson = require('../package.json');

/**
 * @swagger
 * /analytics/visual-queries:
 *   get:
 *     summary: Visual Query Analytics Dashboard
 *     description: |
 *       Renders the Visual Query Analytics Dashboard showing:
 *       - Query latency percentiles (p50, p95, p99)
 *       - Accuracy by domain
 *       - Fallback rates (visual → text, visual → OCR)
 *       - Top queries
 *       - Error rate
 *       - Real-time trend charts
 *     tags: [Analytics, Visual RAG, UI]
 *     responses:
 *       200:
 *         description: Dashboard HTML page
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin required)
 */
router.get('/visual-queries', authenticate, requireAdmin, (req, res) => {
  try {
    const windowHours = parseInt(req.query.windowHours, 10) || 24;
    const snapshot = visualQueryAnalyticsService.getSnapshot({ windowHours });

    res.render('analytics/visual-queries', {
      vm: {
        page: 'visual-query-analytics',
        version: packageJson.version,
        windowHours,
        snapshot
      }
    });
  } catch (error) {
    logger.error('[Analytics] Failed to render dashboard:', error.message);
    res.status(500).render('error', {
      vm: { page: 'error' },
      status: 500,
      message: 'Failed to load analytics dashboard',
      details: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
});

module.exports = router;
