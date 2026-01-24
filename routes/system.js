const express = require('express');
const router = express.Router();
const documentModel = require('../services/documentModel.js');
const logger = require('../services/logger');
const { qdrantAdapter } = require('../services/visual-rag-client/QdrantAdapter');
const axios = require('axios');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: |
 *       Checks the health status of the application and its dependencies.
 *       Returns HTTP 200 if healthy, HTTP 503 if not configured or database unavailable.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Application is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *       503:
 *         description: Application is not healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "database_error"
 *                 message:
 *                   type: string
 *                   example: "Database check failed"
 */
router.get('/health', async (req, res) => {
  try {
    // const isConfigured = await setupService.isConfigured();
    // if (!isConfigured) {
    //   return res.status(503).json({
    //     status: 'not_configured',
    //     message: 'Application setup not completed'
    //   });
    // }
    try {
      await documentModel.isDocumentProcessed(1);
    } catch {
      return res.status(503).json({
        status: 'database_error',
        message: 'Database check failed'
      });
    }

    res.json({ status: 'healthy' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/processing-status:
 *   get:
 *     summary: Get current document processing status
 *     description: |
 *       Returns the current status of document processing, including the number of documents
 *       being processed and any active background tasks.
 *     tags:
 *       - System
 *       - API
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Processing status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isProcessing:
 *                   type: boolean
 *                   description: Whether documents are currently being processed
 *                   example: true
 *                 processedCount:
 *                   type: integer
 *                   description: Total number of documents processed
 *                   example: 42
 *       500:
 *         description: Failed to fetch processing status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch processing status"
 */
router.get('/api/processing-status', async (req, res) => {
  try {
      const status = await documentModel.getCurrentProcessingStatus();
      res.json(status);
  } catch {
      res.status(500).json({ error: 'Failed to fetch processing status' });
  }
});

/**
 * @swagger
 * /api/runtime/state:
 *   get:
 *     summary: Get current runtime system state
 *     description: Returns runtime state including circuit breaker, VRAM, Qdrant, sidecars, and background sync info
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Runtime state retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 circuitBreaker:
 *                   type: object
 *                 vram:
 *                   type: object
 *                 qdrant:
 *                   type: object
 *                 sidecars:
 *                   type: object
 *                 backgroundSync:
 *                   type: object
 */
router.get('/api/runtime/state', async (req, res) => {
  try {
    const runtimeState = {
      circuitBreaker: {
        state: 'CLOSED',
        failures: 0,
        successes: 0
      },
      vram: {
        used: 'N/A',
        total: 'N/A',
        utilization: 0
      },
      qdrant: {
        connected: false,
        collections: 0,
        documents: 0
      },
      sidecars: {
        visualRag: false,
        guidance: false,
        biasEngine: false
      },
      backgroundSync: {
        lastSync: null,
        nextSync: null,
        running: false,
        documentsProcessed: 0
      }
    };

    // Check Qdrant status
    try {
      if (qdrantAdapter && typeof qdrantAdapter.getCollectionInfo === 'function') {
        const collections = await qdrantAdapter.getCollectionInfo();
        if (collections) {
          runtimeState.qdrant.connected = true;
          runtimeState.qdrant.collections = Array.isArray(collections) ? collections.length : 0;
          runtimeState.qdrant.documents = collections.reduce((sum, col) => sum + (col.points_count || 0), 0);
        }
      }
    } catch (qdrantError) {
      logger.debug('[RUNTIME-STATE] Qdrant check failed', { error: qdrantError.message });
    }

    // Check Visual RAG sidecar status
    try {
      const visualRagUrl = process.env.VISUAL_RAG_URL || 'http://visual-rag:8001';
      const visualRagResponse = await axios.get(`${visualRagUrl}/health`, { timeout: 2000 });
      runtimeState.sidecars.visualRag = visualRagResponse.status === 200;
    } catch (visualRagError) {
      logger.debug('[RUNTIME-STATE] Visual RAG health check failed', { error: visualRagError.message });
    }

    // Check Guidance service status
    try {
      const guidanceUrl = process.env.GUIDANCE_SERVICE_URL || 'http://guidance-service:8002';
      const guidanceResponse = await axios.get(`${guidanceUrl}/health`, { timeout: 2000 });
      runtimeState.sidecars.guidance = guidanceResponse.status === 200;
    } catch (guidanceError) {
      logger.debug('[RUNTIME-STATE] Guidance service health check failed', { error: guidanceError.message });
    }

    // Check Bias Engine status
    try {
      const biasEngineUrl = process.env.BIAS_ENGINE_URL || 'bias-engine:50051';
      // For gRPC service, we'll just check if the env var is set
      runtimeState.sidecars.biasEngine = !!process.env.BIAS_ENGINE_URL;
    } catch (biasEngineError) {
      logger.debug('[RUNTIME-STATE] Bias engine check failed', { error: biasEngineError.message });
    }

    // Get background sync status
    try {
      const processingStatus = await documentModel.getCurrentProcessingStatus();
      if (processingStatus) {
        runtimeState.backgroundSync.running = processingStatus.isProcessing || false;
        runtimeState.backgroundSync.documentsProcessed = processingStatus.processedCount || 0;
        runtimeState.backgroundSync.lastSync = processingStatus.lastProcessedTime || null;
        runtimeState.backgroundSync.nextSync = processingStatus.nextScheduledTime || null;
      }
    } catch (syncError) {
      logger.debug('[RUNTIME-STATE] Background sync check failed', { error: syncError.message });
    }

    res.json(runtimeState);
  } catch (error) {
    logger.error('[RUNTIME-STATE] Failed to fetch runtime state', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch runtime state' });
  }
});

/**
 * @swagger
 * /api/key-regenerate:
 *   post:
 *     summary: Regenerate API key
 *     description: |
 *       Generates a new random API key for the application and updates the .env file.
 *       The previous API key will be invalidated immediately after generation.
 *
 *       This API key can be used for programmatic access to the API endpoints
 *       by sending it in the `x-api-key` header of subsequent requests.
 *
 *       **Security Notice**: This operation invalidates any existing API key.
 *       All systems using the previous key will need to be updated.
 *     tags:
 *       - System
 *       - Authentication
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: API key regenerated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: string
 *                   description: The newly generated API key
 *                   example: "3f7a8d6e2c1b5a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5"
 *       401:
 *         description: Unauthorized - JWT authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Authentication required"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error regenerating API key"
 */
router.post('/api/key-regenerate', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const dotenv = require('dotenv');
    const crypto = require('crypto');
    const envPath = path.join(__dirname, '../data/', '.env');
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    // Generiere ein neues API-Token
    const apiKey = crypto.randomBytes(32).toString('hex');
    envConfig.API_KEY = apiKey;

    // Schreibe die aktualisierte .env-Datei
    const envContent = Object.entries(envConfig)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    fs.writeFileSync(envPath, envContent);

    // Setze die Umgebungsvariable für den aktuellen Prozess
    process.env.API_KEY = apiKey;

    // Sende die Antwort zurück
    res.json({ success: apiKey });
    console.log('API key regenerated:', apiKey);
  } catch (error) {
    console.error('API key regeneration error:', error);
    res.status(500).json({ error: 'Error regenerating API key' });
  }
});

module.exports = router;
