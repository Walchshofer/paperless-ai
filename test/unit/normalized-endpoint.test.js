/**
 * Unit Tests - Normalized Image Serving API
 *
 * Tests the /api/normalized/:docId/:page endpoint with mocked filesystem.
 *
 * Coverage:
 * - GET with existing PNG file
 * - GET with missing file (fallback to on-demand)
 * - GET with invalid docId (400 error)
 * - GET with invalid page (400 error)
 * - HEAD with existing file (200)
 * - HEAD with missing file (404)
 *
 * @see routes/api/normalized.js
 */

const assert = require('assert');
const express = require('express');
const request = require('supertest');

describe('Normalized Image Serving API (Unit Tests)', function() {
  let app;

  // Helper to create app with mocked fs access
  function createAppWithMockAccess(mockAccessFn) {
    app = express();
    app.use(express.json());

    // Override fs.promises.access
    const originalAccess = require('fs').promises.access;
    require('fs').promises.access = mockAccessFn;

    // Mock auth middleware so route behavior is testable in isolation.
    const authPath = require.resolve('../../middleware/auth');
    const originalAuth = require.cache[authPath];
    require.cache[authPath] = {
      id: authPath,
      filename: authPath,
      loaded: true,
      exports: {
        authenticateApi: (req, _res, next) => {
          req.user = { id: 1, role: 'admin' };
          next();
        },
      },
    };

    // Stub sendFile to avoid dependency on real files in unit tests.
    app.response.sendFile = function sendFileStub() {
      this.status(200);
      this.end();
    };

    // Clear cached route module
    delete require.cache[require.resolve('../../routes/api/normalized')];

    // Load route with mocked fs
    const normalizedRoutes = require('../../routes/api/normalized');
    app.use('/api/normalized', normalizedRoutes);

    // Return cleanup function
    return () => {
      require('fs').promises.access = originalAccess;
      if (originalAuth) {
        require.cache[authPath] = originalAuth;
      } else {
        delete require.cache[authPath];
      }
    };
  }

  describe('GET /api/normalized/:docId/:page?', function() {
    it('should serve existing PNG file with correct headers', async function() {
      const cleanup = createAppWithMockAccess(async (filePath) => {
        if (filePath.includes('page_1.png')) return Promise.resolve();
        throw new Error('ENOENT');
      });

      try {
        const res = await request(app)
          .get('/api/normalized/123/1')
          .expect(200);

        assert.strictEqual(res.headers['content-type'], 'image/png');
        assert.strictEqual(res.headers['cache-control'], 'public, max-age=86400');
        assert.strictEqual(res.headers['x-normalization-source'], 'persisted');
      } finally {
        cleanup();
      }
    });

    it('should redirect to on-demand when file not found', async function() {
      const cleanup = createAppWithMockAccess(async () => {
        throw new Error('ENOENT');
      });

      try {
        const res = await request(app)
          .get('/api/normalized/789/3')
          .expect(302);

        assert.strictEqual(res.headers.location, '/api/visual-rag/normalized/789?page=3');
      } finally {
        cleanup();
      }
    });

    it('should default to page 1 when page param omitted', async function() {
      const cleanup = createAppWithMockAccess(async (filePath) => {
        if (filePath.includes('page_1.png')) return Promise.resolve();
        throw new Error('ENOENT');
      });

      try {
        const res = await request(app)
          .get('/api/normalized/100')
          .expect(200);

        assert.strictEqual(res.headers['content-type'], 'image/png');
      } finally {
        cleanup();
      }
    });

    it('should return 400 for invalid docId', async function() {
      const cleanup = createAppWithMockAccess(async () => {});
      try {
        const res = await request(app)
          .get('/api/normalized/invalid/1')
          .expect(400);

        assert.strictEqual(res.body.error, 'Invalid document id');
      } finally {
        cleanup();
      }
    });

    it('should return 400 for zero docId', async function() {
      const cleanup = createAppWithMockAccess(async () => {});
      try {
        const res = await request(app)
          .get('/api/normalized/0/1')
          .expect(400);

        assert.strictEqual(res.body.error, 'Invalid document id');
      } finally {
        cleanup();
      }
    });

    it('should return 400 for invalid page', async function() {
      const cleanup = createAppWithMockAccess(async () => {});
      try {
        const res = await request(app)
          .get('/api/normalized/123/invalid')
          .expect(400);

        assert.strictEqual(res.body.error, 'Invalid page number');
      } finally {
        cleanup();
      }
    });

    it('should return 400 for zero page', async function() {
      const cleanup = createAppWithMockAccess(async () => {});
      try {
        const res = await request(app)
          .get('/api/normalized/123/0')
          .expect(400);

        assert.strictEqual(res.body.error, 'Invalid page number');
      } finally {
        cleanup();
      }
    });
  });

  describe('HEAD /api/normalized/:docId/:page?', function() {
    it('should return 200 with headers for existing PNG file', async function() {
      const cleanup = createAppWithMockAccess(async (filePath) => {
        if (filePath.includes('page_1.png')) return Promise.resolve();
        throw new Error('ENOENT');
      });

      try {
        const res = await request(app)
          .head('/api/normalized/123/1')
          .expect(200);

        assert.strictEqual(res.headers['x-normalization-source'], 'persisted');
        assert.strictEqual(res.headers['x-normalization-format'], 'png');
      } finally {
        cleanup();
      }
    });

    it('should return 404 with on-demand header when file not found', async function() {
      const cleanup = createAppWithMockAccess(async () => {
        throw new Error('ENOENT');
      });

      try {
        const res = await request(app)
          .head('/api/normalized/789/3')
          .expect(404);

        assert.strictEqual(res.headers['x-normalization-source'], 'on-demand');
      } finally {
        cleanup();
      }
    });

    it('should default to page 1 when page param omitted', async function() {
      const cleanup = createAppWithMockAccess(async (filePath) => {
        if (filePath.includes('page_1.png')) return Promise.resolve();
        throw new Error('ENOENT');
      });

      try {
        const res = await request(app)
          .head('/api/normalized/100')
          .expect(200);

        assert.strictEqual(res.headers['x-normalization-format'], 'png');
      } finally {
        cleanup();
      }
    });

    it('should return 400 for invalid docId', async function() {
      const cleanup = createAppWithMockAccess(async () => {});
      try {
        await request(app)
          .head('/api/normalized/invalid/1')
          .expect(400);
      } finally {
        cleanup();
      }
    });
  });

  describe('Cache Headers', function() {
    it('should set 24-hour cache for persisted images', async function() {
      const cleanup = createAppWithMockAccess(async (filePath) => {
        if (filePath.includes('page_1.png')) return Promise.resolve();
        throw new Error('ENOENT');
      });

      try {
        const res = await request(app)
          .get('/api/normalized/123/1')
          .expect(200);

        assert.strictEqual(res.headers['cache-control'], 'public, max-age=86400');
      } finally {
        cleanup();
      }
    });
  });
});
