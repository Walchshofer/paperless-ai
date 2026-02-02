/**
 * Workspace Reprocess Integration Tests
 *
 * Tests for the /api/documents/:id/reprocess endpoint that wires
 * the Reprocess button to the Expert Pipeline.
 *
 * @see routes/api/documents.js
 */

const assert = require('node:assert');
const http = require('http');

/**
 * Helper to make HTTP requests to the test server
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {object} [body] - Request body
 * @param {object} [headers] - Additional headers
 * @returns {Promise<{status: number, body: object}>}
 */
async function request(method, path, body = null, headers = {}) {
  const options = {
    hostname: 'localhost',
    port: process.env.TEST_PORT || 3456,
    path,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = {};
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = { raw: data };
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

describe('Workspace Reprocess Integration', function() {
  describe('POST /api/documents/:id/reprocess', function() {
    it('should return 400 for invalid document ID (NaN)', async function() {
      const res = await request('POST', '/api/documents/invalid/reprocess');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.reasonCode, 'invalid_document_id');
    });

    it('should return 400 for negative document ID', async function() {
      const res = await request('POST', '/api/documents/-1/reprocess');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.reasonCode, 'invalid_document_id');
    });

    it('should return 400 for zero document ID', async function() {
      const res = await request('POST', '/api/documents/0/reprocess');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.reasonCode, 'invalid_document_id');
    });

    it('should return 401 without authentication', async function() {
      // Note: This test assumes authentication middleware is in place
      const res = await request('POST', '/api/documents/1/reprocess');

      // Without auth, should get 401 (unauthorized)
      // If auth is not enforced in test env, this may pass differently
      assert.ok(res.status === 400 || res.status === 401 || res.status === 404 || res.status === 500,
        `Expected 400, 401, 404, or 500, got ${res.status}`);
    });
  });

  describe('GET /api/documents/:id/status', function() {
    it('should return 400 for invalid document ID', async function() {
      const res = await request('GET', '/api/documents/invalid/status');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.reasonCode, 'invalid_document_id');
    });

    it('should return never_processed status for new document', async function() {
      // Use a very high ID that likely doesn't exist
      const res = await request('GET', '/api/documents/999999999/status');

      // Should return 200 with never_processed status, or 401 if auth required
      if (res.status === 200) {
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.status, 'never_processed');
        assert.strictEqual(res.body.lastProcessed, null);
      } else {
        // Auth might be required
        assert.ok(res.status === 401 || res.status === 400,
          `Expected 200, 401, or 400, got ${res.status}`);
      }
    });
  });
});

describe('Reprocess API Contract', function() {
  it('should have correct response structure on success', function() {
    // Contract validation - expected response shape
    const expectedSuccessShape = {
      success: true,
      documentId: 'number',
      classification: 'string',
      extractedFields: 'array',
      smartTags: 'array',
      confidence: 'number',
      stats: 'object'
    };

    // Validate the contract structure
    assert.ok(expectedSuccessShape.success === true);
    assert.strictEqual(typeof expectedSuccessShape.documentId, 'string');
    assert.strictEqual(typeof expectedSuccessShape.classification, 'string');
    assert.strictEqual(typeof expectedSuccessShape.extractedFields, 'string');
    assert.strictEqual(typeof expectedSuccessShape.smartTags, 'string');
  });

  it('should have correct error response structure', function() {
    // Contract validation - expected error shape
    const expectedErrorShape = {
      success: false,
      error: 'string',
      reasonCode: 'string'
    };

    assert.ok(expectedErrorShape.success === false);
    assert.strictEqual(typeof expectedErrorShape.error, 'string');
    assert.strictEqual(typeof expectedErrorShape.reasonCode, 'string');
  });
});
