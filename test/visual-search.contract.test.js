
const request = require('supertest');
const assert = require('assert');
const app = require('../server');
const { visualSearchClient } = require('../services/visual-rag-client/VisualSearchClient');

// Test helper: call the visual search endpoint via app to exercise full middleware
async function callVisualSearch(payload = {}, headers = {}) {
    const res = await request(app)
        .post('/api/visual-rag/search/visual')
        .set(headers)
        .send(payload);
    return { status: res.status, headers: res.headers, body: res.body };
}

describe('Visual Search API Contract', () => {
    let originalSearchImageAlpha9;
    let originalIsAvailable;

    before(() => {
        // Save original methods
        originalSearchImageAlpha9 = visualSearchClient.searchImageAlpha9;
        originalIsAvailable = visualSearchClient.isAvailable;
    });

    after(() => {
        // Restore original methods
        visualSearchClient.searchImageAlpha9 = originalSearchImageAlpha9;
        visualSearchClient.isAvailable = originalIsAvailable;
    });

    beforeEach(() => {
        // Default mocks
        visualSearchClient.isAvailable = async () => true;
        visualSearchClient.searchImageAlpha9 = async (image, collection, _filters, _k) => {
            return {
                collectionUsed: collection,
                scoreType: 'maxsim',
                executionTimeMs: 10,
                results: [
                    {
                        docId: 123,
                        pageNum: 1,
                        score: 0.95,
                        filePath: 'docs/test.pdf',
                        metadata: { title: 'Test Doc' }
                    }
                ]
            };
        };
    });

    it('should return 200 and results for valid image payload', async () => {
        const payload = {
            image: 'VGhpcyBpcyBhIHRlc3QgYmFzZTY0IHN0cmluZy4=',
            k: 5
        };

        const res = await callVisualSearch(payload);

        // Expect JSON Content-Type and 200
        assert.match(res.headers['content-type'], /json/);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(Array.isArray(res.body.results), true);
        assert.strictEqual(res.body.results.length, 1);
        assert.strictEqual(res.body.results[0].docId, 123);
        assert.strictEqual(res.body.results[0].score, 0.95);
    });

    it('should return 400 if image is missing', async () => {
        const payload = {
            k: 5
        };

        const res = await callVisualSearch(payload);

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.success, false);
        assert.match(res.body.error, /required/i);
    });

    it('should return 400 if image payload is not valid base64', async () => {
        const payload = {
            image: 'not-valid-base64!@#'
        };

        const res = await callVisualSearch(payload);

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.success, false);
        assert.match(res.body.error, /invalid image/i);
    });

    it('should return 503 if sidecar is unavailable', async () => {
        // Mock unavailability
        visualSearchClient.isAvailable = async () => false;

        const payload = {
            image: 'VGhpcyBpcyBhIHRlc3QgYmFzZTY0IHN0cmluZy4='
        };

        const res = await callVisualSearch(payload);

        assert.strictEqual(res.status, 503);
        assert.strictEqual(res.body.success, false);
        assert.match(res.body.error, /unavailable/i);
        // Verify circuit breaker info is present per contract
        assert.strictEqual(res.body.circuit_breaker, 'open');
    });

    it('should handle large payloads gracefully (mocking success)', async () => {
        // Create a large string (approx 1MB)
        const largeImage = 'A'.repeat(1024 * 1024);
        const payload = {
            image: largeImage
        };

        const res = await callVisualSearch(payload);

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    });

    // =========================================================================
    // Middleware Integration Tests (verify full Express stack)
    // =========================================================================
    describe('Middleware Integration', () => {
        it('should return proper CORS headers', async () => {
            const payload = {
                image: 'VGhpcyBpcyBhIHRlc3QgYmFzZTY0IHN0cmluZy4='
            };

            const res = await callVisualSearch(payload);

            assert.ok(res.headers['access-control-allow-origin'], 'CORS origin header missing');
        });

        it('should parse JSON body correctly', async () => {
            const payload = {
                image: 'VGhpcyBpcyBhIHRlc3QgYmFzZTY0IHN0cmluZy4=',
                collection: 'visual_pages',
                k: 10,
                filters: { doc_id: 123 }
            };

            const res = await callVisualSearch(payload);

            // Body should have been parsed - handler should receive all fields
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.collection, 'visual_pages');
        });

        it('should not redirect to login for API requests', async () => {
            const payload = {
                image: 'VGhpcyBpcyBhIHRlc3QgYmFzZTY0IHN0cmluZy4='
            };

            const res = await callVisualSearch(payload);

            // API requests should never get 302 redirects
            assert.notStrictEqual(res.status, 302, 'API should not redirect');
        });

        it('should handle X-Request-Id header', async () => {
            const requestId = `contract-test-${Date.now()}`;
            const payload = {
                image: 'VGhpcyBpcyBhIHRlc3QgYmFzZTY0IHN0cmluZy4='
            };

            const res = await callVisualSearch(payload, { 'x-request-id': requestId });

            assert.strictEqual(res.headers['x-request-id'], requestId);
        });
    });
});
