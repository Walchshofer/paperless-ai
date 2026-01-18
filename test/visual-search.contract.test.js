
const request = require('supertest');
const assert = require('assert');
const app = require('../server');
const { visualSearchClient } = require('../services/visual-rag-client/VisualSearchClient');

describe('Visual Search API Contract', () => {
    let originalSearchImage;
    let originalIsAvailable;

    before(() => {
        // Save original methods
        originalSearchImage = visualSearchClient.searchImage;
        originalIsAvailable = visualSearchClient.isAvailable;
    });

    after(() => {
        // Restore original methods
        visualSearchClient.searchImage = originalSearchImage;
        visualSearchClient.isAvailable = originalIsAvailable;
    });

    beforeEach(() => {
        // Default mocks
        visualSearchClient.isAvailable = async () => true;
        visualSearchClient.searchImage = async (image, options) => {
            return {
                query: '[IMAGE]',
                results: [
                    {
                        docId: 123,
                        pageNum: 1,
                        score: 0.95,
                        filePath: 'docs/test.pdf',
                        metadata: { title: 'Test Doc' }
                    }
                ],
                totalResults: 1
            };
        };
    });

    it('should return 200 and results for valid image payload', async () => {
        const payload = {
            image: 'VGhpcyBpcyBhIHRlc3QgYmFzZTY0IHN0cmluZy4=',
            k: 5
        };

        const res = await request(app)
            .post('/api/visual-rag/search/visual')
            .send(payload)
            .expect('Content-Type', /json/)
            .expect(200);

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

        const res = await request(app)
            .post('/api/visual-rag/search/visual')
            .send(payload)
            .expect('Content-Type', /json/)
            .expect(400);

        assert.strictEqual(res.body.success, false);
        assert.match(res.body.error, /required/i);
    });

    it('should return 400 if image payload is not valid base64', async () => {
        const payload = {
            image: 'not-valid-base64!@#'
        };

        const res = await request(app)
            .post('/api/visual-rag/search/visual')
            .send(payload)
            .expect('Content-Type', /json/)
            .expect(400);

        assert.strictEqual(res.body.success, false);
        assert.match(res.body.error, /invalid image/i);
    });

    it('should return 503 if sidecar is unavailable', async () => {
        // Mock unavailability
        visualSearchClient.isAvailable = async () => false;

        const payload = {
            image: 'VGhpcyBpcyBhIHRlc3QgYmFzZTY0IHN0cmluZy4='
        };

        const res = await request(app)
            .post('/api/visual-rag/search/visual')
            .send(payload)
            .expect('Content-Type', /json/)
            .expect(503);

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

        const res = await request(app)
            .post('/api/visual-rag/search/visual')
            .send(payload)
            .expect(200);
        
        assert.strictEqual(res.body.success, true);
    });
});
