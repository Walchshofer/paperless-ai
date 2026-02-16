/* eslint-env mocha */

/**
 * Integration Tests - Normalized Image Serving API
 *
 * Tests the /api/normalized endpoint with real filesystem operations.
 * Uses temporary directory for test fixtures.
 *
 * Coverage:
 * - Serve real PNG file from disk
 * - Serve real WebP file from disk
 * - Fallback to on-demand when file missing
 * - Verify cache headers set correctly
 * - HEAD endpoint behavior
 *
 * @see routes/api/normalized.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const request = require('supertest');
const express = require('express');
const os = require('os');

describe('Normalized Image Serving API (Integration Tests)', function() {
  let app;
  let testDir;
  let originalEnv;

  before(async function() {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `normalized-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Set environment variable to test directory
    originalEnv = process.env.NORMALIZED_IMAGES_DIR;
    process.env.NORMALIZED_IMAGES_DIR = testDir;

    // Create test Express app
    app = express();
    app.use(express.json());

    // Mock authenticateApi middleware (pass-through for integration tests)
    const authMiddleware = (req, res, next) => next();

    // Manually inject mock auth to avoid requiring full server setup
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function(id) {
      if (id === '../../middleware/auth') {
        return { authenticateApi: authMiddleware };
      }
      if (id === '../../services/logger') {
        return {
          info: () => {},
          debug: () => {},
          error: () => {},
          warn: () => {}
        };
      }
      return originalRequire.apply(this, arguments);
    };

    // Load the normalized routes
    delete require.cache[require.resolve('../../routes/api/normalized')];
    const normalizedRoutes = require('../../routes/api/normalized');
    app.use('/api/normalized', normalizedRoutes);

    // Restore original require
    Module.prototype.require = originalRequire;
  });

  after(async function() {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      console.warn('Failed to cleanup test directory:', err.message);
    }

    // Restore environment
    if (originalEnv !== undefined) {
      process.env.NORMALIZED_IMAGES_DIR = originalEnv;
    } else {
      delete process.env.NORMALIZED_IMAGES_DIR;
    }
  });

  describe('Serving Persisted Images', function() {
    it('should serve a real PNG file from disk', async function() {
      const docId = 123;
      const page = 1;

      // Create test fixture: PNG file
      const docDir = path.join(testDir, String(docId));
      await fs.mkdir(docDir, { recursive: true });
      const pngPath = path.join(docDir, `page_${page}.png`);

      // Create a minimal valid PNG file (1x1 transparent pixel)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
        0x42, 0x60, 0x82
      ]);
      await fs.writeFile(pngPath, pngBuffer);

      const res = await request(app)
        .get(`/api/normalized/${docId}/${page}`)
        .expect(200);

      assert.strictEqual(res.headers['content-type'], 'image/png');
      assert.strictEqual(res.headers['cache-control'], 'public, max-age=86400');
      assert.strictEqual(res.headers['x-normalization-source'], 'persisted');
      assert(Buffer.isBuffer(res.body) || typeof res.body === 'object');
    });

    it('should serve a real WebP file when PNG not found', async function() {
      const docId = 456;
      const page = 2;

      // Create test fixture: WebP file only
      const docDir = path.join(testDir, String(docId));
      await fs.mkdir(docDir, { recursive: true });
      const webpPath = path.join(docDir, `page_${page}.webp`);

      // Create a minimal valid WebP file (1x1 transparent pixel)
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        0x1A, 0x00, 0x00, 0x00, // File size
        0x57, 0x45, 0x42, 0x50, // "WEBP"
        0x56, 0x50, 0x38, 0x4C, // "VP8L"
        0x0E, 0x00, 0x00, 0x00, // Chunk size
        0x2F, 0x00, 0x00, 0x00, // VP8L signature
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00
      ]);
      await fs.writeFile(webpPath, webpBuffer);

      const res = await request(app)
        .get(`/api/normalized/${docId}/${page}`)
        .expect(200);

      assert.strictEqual(res.headers['content-type'], 'image/webp');
      assert.strictEqual(res.headers['cache-control'], 'public, max-age=86400');
      assert.strictEqual(res.headers['x-normalization-source'], 'persisted');
    });

    it('should fallback to on-demand when file missing', async function() {
      const docId = 999;
      const page = 1;

      // No file created - should trigger fallback

      const res = await request(app)
        .get(`/api/normalized/${docId}/${page}`)
        .expect(302);

      assert.strictEqual(
        res.headers.location,
        `/api/visual-rag/normalized/${docId}?page=${page}`
      );
    });
  });

  describe('HEAD Endpoint', function() {
    it('should return 200 for existing PNG file', async function() {
      const docId = 777;
      const page = 1;

      // Create test fixture
      const docDir = path.join(testDir, String(docId));
      await fs.mkdir(docDir, { recursive: true });
      await fs.writeFile(path.join(docDir, `page_${page}.png`), 'test-png');

      const res = await request(app)
        .head(`/api/normalized/${docId}/${page}`)
        .expect(200);

      assert.strictEqual(res.headers['x-normalization-source'], 'persisted');
      assert.strictEqual(res.headers['x-normalization-format'], 'png');
    });

    it('should return 200 for existing WebP file', async function() {
      const docId = 888;
      const page = 1;

      // Create test fixture
      const docDir = path.join(testDir, String(docId));
      await fs.mkdir(docDir, { recursive: true });
      await fs.writeFile(path.join(docDir, `page_${page}.webp`), 'test-webp');

      const res = await request(app)
        .head(`/api/normalized/${docId}/${page}`)
        .expect(200);

      assert.strictEqual(res.headers['x-normalization-source'], 'persisted');
      assert.strictEqual(res.headers['x-normalization-format'], 'webp');
    });

    it('should return 404 for missing file', async function() {
      const docId = 999;
      const page = 99;

      const res = await request(app)
        .head(`/api/normalized/${docId}/${page}`)
        .expect(404);

      assert.strictEqual(res.headers['x-normalization-source'], 'on-demand');
    });
  });

  describe('Cache Headers', function() {
    it('should set 24-hour cache for persisted images', async function() {
      const docId = 111;
      const page = 1;

      // Create test fixture
      const docDir = path.join(testDir, String(docId));
      await fs.mkdir(docDir, { recursive: true });
      await fs.writeFile(path.join(docDir, `page_${page}.png`), 'test-cache');

      const res = await request(app)
        .get(`/api/normalized/${docId}/${page}`)
        .expect(200);

      const cacheControl = res.headers['cache-control'];
      assert(cacheControl.includes('public'));
      assert(cacheControl.includes('max-age=86400')); // 24 hours in seconds
    });
  });

  describe('Multi-page Documents', function() {
    it('should serve different pages from same document', async function() {
      const docId = 222;

      // Create test fixtures for pages 1, 2, 3
      const docDir = path.join(testDir, String(docId));
      await fs.mkdir(docDir, { recursive: true });
      await fs.writeFile(path.join(docDir, 'page_1.png'), 'page-1-content');
      await fs.writeFile(path.join(docDir, 'page_2.png'), 'page-2-content');
      await fs.writeFile(path.join(docDir, 'page_3.png'), 'page-3-content');

      // Test each page
      for (let page = 1; page <= 3; page++) {
        const res = await request(app)
          .get(`/api/normalized/${docId}/${page}`)
          .expect(200);

        assert.strictEqual(res.headers['content-type'], 'image/png');
        assert.strictEqual(res.headers['x-normalization-source'], 'persisted');
      }
    });

    it('should fallback for missing page in multi-page doc', async function() {
      const docId = 333;

      // Create only page 1
      const docDir = path.join(testDir, String(docId));
      await fs.mkdir(docDir, { recursive: true });
      await fs.writeFile(path.join(docDir, 'page_1.png'), 'page-1-only');

      // Page 1 should work
      await request(app)
        .get(`/api/normalized/${docId}/1`)
        .expect(200);

      // Page 2 should fallback
      const res = await request(app)
        .get(`/api/normalized/${docId}/2`)
        .expect(302);

      assert.strictEqual(res.headers.location, '/api/visual-rag/normalized/333?page=2');
    });
  });
});
