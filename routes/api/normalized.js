/**
 * Normalized Image Serving API
 *
 * Serves persisted normalized images from disk with transparent fallback
 * to on-demand rendering via /api/visual-rag/normalized/:docId
 *
 * @module routes/api/normalized
 * @see docs/AUTOMATIC_NORMALIZATION_PLAN.md §1.3 (Serving Endpoint)
 * @see docs/epics/.../eb83ccc4-5f01-4d4b-927d-e61f811f8664 (Ticket)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { authenticateApi } = require('../../middleware/auth');
const logger = require('../../services/logger');

// Base directory for normalized images (matches existing /app/data mount)
const NORMALIZED_BASE_DIR = process.env.NORMALIZED_IMAGES_DIR || '/app/data/normalized';

/**
 * GET /api/normalized/:docId/:page?
 *
 * Serves persisted normalized images from disk.
 * Falls back to on-demand rendering if not persisted.
 *
 * Invariants:
 * - Workspace viewer displays documents (no broken images)
 * - Fallback to on-demand is transparent (users don't notice)
 * - Existing /api/visual-rag/normalized/:docId endpoint unchanged
 *
 * @param {number} docId - Document ID (Paperless)
 * @param {number} [page=1] - Page number (1-indexed)
 * @returns {Buffer} Image file (PNG or WebP)
 *
 * @example
 * GET /api/normalized/123/1  → /app/data/normalized/123/page_1.png
 * GET /api/normalized/456    → /app/data/normalized/456/page_1.png
 */
router.get('/:docId/:page?', authenticateApi, async (req, res) => {
  const docId = parseInt(req.params.docId, 10);
  const page = parseInt(req.params.page || '1', 10);

  // Validate inputs
  if (!Number.isFinite(docId) || docId <= 0) {
    return res.status(400).json({ error: 'Invalid document id' });
  }
  if (!Number.isFinite(page) || page <= 0) {
    return res.status(400).json({ error: 'Invalid page number' });
  }

  // Construct file paths: /app/data/normalized/{docId}/page_{page}.{png|webp}
  const docDir = path.join(NORMALIZED_BASE_DIR, String(docId));
  const pngPath = path.join(docDir, `page_${page}.png`);
  const webpPath = path.join(docDir, `page_${page}.webp`);

  try {
    // Try PNG first (higher quality), then WebP (smaller size)
    let filePath = null;
    let contentType = null;

    try {
      await fs.access(pngPath);
      filePath = pngPath;
      contentType = 'image/png';
    } catch {
      try {
        await fs.access(webpPath);
        filePath = webpPath;
        contentType = 'image/webp';
      } catch {
        // No persisted file found - fall back to on-demand rendering
        logger.info({
          event: 'normalized_fallback_triggered',
          docId,
          page,
          reason: 'file_not_found'
        });
        return res.redirect(`/api/visual-rag/normalized/${docId}?page=${page}`);
      }
    }

    // Serve the persisted file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h (persisted files)
    res.setHeader('X-Normalization-Source', 'persisted');

    logger.debug({
      event: 'normalized_served_persisted',
      docId,
      page,
      format: contentType.split('/')[1],
      path: filePath
    });

    return res.sendFile(filePath);

  } catch (error) {
    // Fall back to on-demand on any error (file read errors, permission issues)
    logger.error({
      event: 'normalized_file_error',
      docId,
      page,
      error: error.message,
      fallback: 'on-demand'
    });
    return res.redirect(`/api/visual-rag/normalized/${docId}?page=${page}`);
  }
});

/**
 * HEAD /api/normalized/:docId/:page?
 *
 * Check if a normalized image exists without downloading.
 * Used by frontend to determine source indicator (persisted vs on-demand).
 *
 * Response Headers:
 * - X-Normalization-Source: 'persisted' | 'on-demand'
 * - X-Normalization-Format: 'png' | 'webp' (only if persisted)
 *
 * Status Codes:
 * - 200: File exists (persisted)
 * - 404: File does not exist (on-demand)
 * - 400: Invalid docId/page
 *
 * @example
 * HEAD /api/normalized/123/1
 * → 200 OK, X-Normalization-Source: persisted, X-Normalization-Format: png
 *
 * HEAD /api/normalized/999/1
 * → 404 Not Found, X-Normalization-Source: on-demand
 */
router.head('/:docId/:page?', authenticateApi, async (req, res) => {
  const docId = parseInt(req.params.docId, 10);
  const page = parseInt(req.params.page || '1', 10);

  // Validate inputs
  if (!Number.isFinite(docId) || docId <= 0) {
    return res.status(400).end();
  }
  if (!Number.isFinite(page) || page <= 0) {
    return res.status(400).end();
  }

  const docDir = path.join(NORMALIZED_BASE_DIR, String(docId));
  const pngPath = path.join(docDir, `page_${page}.png`);
  const webpPath = path.join(docDir, `page_${page}.webp`);

  try {
    // Check PNG first
    await fs.access(pngPath);
    res.setHeader('X-Normalization-Source', 'persisted');
    res.setHeader('X-Normalization-Format', 'png');
    return res.status(200).end();
  } catch {
    try {
      // Check WebP
      await fs.access(webpPath);
      res.setHeader('X-Normalization-Source', 'persisted');
      res.setHeader('X-Normalization-Format', 'webp');
      return res.status(200).end();
    } catch {
      // File not found - indicate on-demand fallback
      res.setHeader('X-Normalization-Source', 'on-demand');
      return res.status(404).end();
    }
  }
});

module.exports = router;
