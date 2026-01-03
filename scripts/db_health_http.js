#!/usr/bin/env node
const express = require('express');
const app = express();
const cfg = require('../config/config');
const { visualOverlayRepository } = require('../services/visual-rag/VisualOverlayRepository');

const port = process.env.PAPERLESS_AI_PORT || 3001;

app.get('/health/database', async (req, res) => {
  try {
    // Test basic connectivity
    const isConnected = await visualOverlayRepository.isAvailable(false);
    if (!isConnected) {
      return res.status(503).json({
        status: 'unhealthy',
        database: {
          connected: false,
          host: cfg.postgres.host,
          port: cfg.postgres.port,
          database: cfg.postgres.database,
          error: 'Database connection failed'
        },
        troubleshooting: [
          'Check if PostgreSQL container is running: docker ps | grep paperless_db',
          'Verify credentials in docker-compose.env',
          'Check container logs: docker logs paperless_db'
        ]
      });
    }

    // Check pg_vector extension
    const pgvectorCheck = await visualOverlayRepository.checkPgVectorExtension();
    
    // Check schema readiness
    const schemaReady = await visualOverlayRepository.ensureEnhancedSchema();

    const response = {
      status: pgvectorCheck.available && schemaReady ? 'healthy' : 'degraded',
      database: {
        connected: true,
        host: cfg.postgres.host,
        port: cfg.postgres.port,
        database: cfg.postgres.database
      },
      pgvector: {
        available: pgvectorCheck.available,
        version: pgvectorCheck.version,
        error: pgvectorCheck.error
      },
      schema: {
        ready: schemaReady
      }
    };

    if (!pgvectorCheck.available || !schemaReady) {
      response.troubleshooting = [
        'Verify docker-compose.yml uses pgvector/pgvector:pg16 image',
        'Check PostgreSQL logs: docker logs paperless_db',
        'Run migration: docker exec paperless_ai node migrations/run-migration.js'
      ];
      return res.status(503).json(response);
    }

    res.json(response);
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: error.message,
      troubleshooting: [
        'Check application logs for detailed error information',
        'Verify all environment variables are set correctly',
        'Restart services: docker-compose restart'
      ]
    });
  }
});

app.listen(port, () => {
  console.log(`db health server listening on port ${port}`);
});