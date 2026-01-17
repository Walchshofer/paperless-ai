/**
 * Alpha-9 Visual Search API Integration Tests
 *
 * Tests the Alpha-9 protocol implementation including:
 * - Contract validation
 * - Collection routing (visual_pages, visual_overlays)
 * - Expert Filtering (doc_id, tag_ids, correspondent_id)
 * - MaxSim score validation
 * - 503 Initializing state handling
 * - Timeout handling
 * - Circuit breaker integration
 *
 * Architecture Reference: ticket:007.1, ticket:007.2
 */

const request = require('supertest');
const assert = require('assert');
const app = require('../../server');

const { startAlpha9SidecarMock, MockStates } = require('../helpers/sidecar-mock-alpha9');
const {
    MINIMAL_PNG_BASE64,
    EMPTY_IMAGE
} = require('../fixtures/visual_search');

// Import client for direct testing
const { VisualSearchClient, ErrorTypes, VALID_COLLECTIONS } = require('../../services/visual-rag/VisualSearchClient');

describe('Alpha-9 Visual Search API', function () {
    this.timeout(30000);

    let mockSidecar;
    let testClient;

    before(async function () {
        // Start mock sidecar on test port
        try {
            mockSidecar = await startAlpha9SidecarMock(8099, { state: MockStates.HEALTHY });
            testClient = new VisualSearchClient({
                baseUrl: 'http://localhost:8099',
                timeout: 5000,
                queryTimeout: 500
            });
        } catch (err) {
            console.warn('Mock sidecar setup failed:', err.message);
            this.skip();
        }
    });

    after(async function () {
        if (mockSidecar) {
            await mockSidecar.stop();
        }
    });

    // =========================================================================
    // Contract Validation Tests (ticket:007.1)
    // =========================================================================
    describe('Contract Validation', function () {

        it('should accept valid image and return structured response', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: MINIMAL_PNG_BASE64,
                    collection: 'visual_pages',
                    k: 5
                })
                .expect('Content-Type', /json/);

            // May return 200 or 503 depending on sidecar availability
            if (res.status === 200) {
                assert.strictEqual(res.body.success, true);
                assert.ok(Array.isArray(res.body.results), 'results should be array');
                assert.ok(res.body.collectionUsed, 'collectionUsed should be present');
            } else if (res.status === 503) {
                assert.strictEqual(res.body.success, false);
                assert.ok(res.body.errorType, 'errorType should be present on 503');
            }
        });

        it('should return 400 for missing image', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    collection: 'visual_pages',
                    k: 5
                })
                .expect(400);

            assert.strictEqual(res.body.success, false);
            assert.ok(res.body.error, 'error message should be present');
        });

        it('should return 400 for empty image', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: EMPTY_IMAGE,
                    collection: 'visual_pages'
                })
                .expect(400);

            assert.strictEqual(res.body.success, false);
        });

        it('should return 400 for invalid collection name', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: MINIMAL_PNG_BASE64,
                    collection: 'invalid_collection'
                })
                .expect(400);

            assert.strictEqual(res.body.success, false);
            assert.ok(res.body.error.includes('collection'), 'error should mention collection');
        });

        it('should include X-Request-Id in response headers', async function () {
            const requestId = 'test-req-12345';
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .set('X-Request-Id', requestId)
                .send({
                    image: MINIMAL_PNG_BASE64,
                    collection: 'visual_pages'
                });

            assert.ok(res.headers['x-request-id'], 'X-Request-Id should be in response');
        });

    });

    // =========================================================================
    // Collection Routing Tests (ticket:007.1)
    // =========================================================================
    describe('Collection Routing', function () {

        it('should default to visual_pages collection', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: MINIMAL_PNG_BASE64
                    // No collection specified
                });

            if (res.status === 200) {
                assert.strictEqual(res.body.collectionUsed, 'visual_pages');
            }
        });

        it('should route to visual_pages when specified', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: MINIMAL_PNG_BASE64,
                    collection: 'visual_pages'
                });

            if (res.status === 200) {
                assert.strictEqual(res.body.collectionUsed, 'visual_pages');
            }
        });

        it('should route to visual_overlays when specified', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: MINIMAL_PNG_BASE64,
                    collection: 'visual_overlays'
                });

            if (res.status === 200) {
                assert.strictEqual(res.body.collectionUsed, 'visual_overlays');
            }
        });

        it('should expose VALID_COLLECTIONS constant', function () {
            assert.deepStrictEqual(VALID_COLLECTIONS, ['visual_pages', 'visual_overlays']);
        });

    });

    // =========================================================================
    // Expert Filtering Tests (ticket:007.1)
    // =========================================================================
    describe('Expert Filtering', function () {

        it('should accept doc_id filter', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: MINIMAL_PNG_BASE64,
                    filters: { doc_id: 123 }
                });

            // Filter acceptance is validated (not filtered results in mock)
            assert.ok(res.status === 200 || res.status === 503);
        });

        it('should accept tag_ids filter', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: MINIMAL_PNG_BASE64,
                    filters: { tag_ids: [1, 3, 7] }
                });

            assert.ok(res.status === 200 || res.status === 503);
        });

        it('should accept correspondent_id filter', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: MINIMAL_PNG_BASE64,
                    filters: { correspondent_id: 5 }
                });

            assert.ok(res.status === 200 || res.status === 503);
        });

        it('should accept combined filters', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: MINIMAL_PNG_BASE64,
                    filters: {
                        doc_id: 123,
                        tag_ids: [1, 3],
                        correspondent_id: 5
                    }
                });

            assert.ok(res.status === 200 || res.status === 503);
        });

        it('should handle empty filters object', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: MINIMAL_PNG_BASE64,
                    filters: {}
                });

            assert.ok(res.status === 200 || res.status === 503);
        });

    });

    // =========================================================================
    // MaxSim Score Validation (ticket:007.1)
    // =========================================================================
    describe('MaxSim Score Validation', function () {

        it('should return MaxSim scores in results', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: MINIMAL_PNG_BASE64,
                    k: 5
                });

            if (res.status === 200 && res.body.results.length > 0) {
                const firstResult = res.body.results[0];
                assert.ok(
                    typeof firstResult.score === 'number',
                    'score should be a number'
                );
                assert.ok(
                    firstResult.score >= 0 && firstResult.score <= 1,
                    'score should be between 0 and 1'
                );
            }
        });

        it('should include maxsim_score_mean in response', async function () {
            const res = await request(app)
                .post('/api/visual-rag/search/visual')
                .send({
                    image: MINIMAL_PNG_BASE64,
                    k: 5
                });

            if (res.status === 200 && res.body.results.length > 0) {
                assert.ok(
                    res.body.maxsim_score_mean !== undefined,
                    'maxsim_score_mean should be present'
                );
            }
        });

    });

    // =========================================================================
    // Client Direct Tests (ticket:007.1)
    // =========================================================================
    describe('VisualSearchClient.searchImageAlpha9', function () {

        it('should throw on invalid collection', async function () {
            try {
                await testClient.searchImageAlpha9(MINIMAL_PNG_BASE64, 'invalid_col');
                assert.fail('Should have thrown');
            } catch (err) {
                assert.ok(err.message.includes('Invalid collection'));
            }
        });

        it('should throw on missing image', async function () {
            try {
                await testClient.searchImageAlpha9('', 'visual_pages');
                assert.fail('Should have thrown');
            } catch (err) {
                assert.ok(err.message.includes('non-empty string'));
            }
        });

        it('should return structured result on success', async function () {
            if (!mockSidecar) this.skip();

            mockSidecar.setState(MockStates.HEALTHY);
            const result = await testClient.searchImageAlpha9(
                MINIMAL_PNG_BASE64,
                'visual_pages',
                {},
                5
            );

            assert.ok(Array.isArray(result.results));
            assert.ok(result.collectionUsed);
            assert.ok(result.scoreType);
        });

    });

    // =========================================================================
    // 503 Initializing State Tests (ticket:007.2)
    // =========================================================================
    describe('503 Initializing State', function () {

        it('should return SIDECAR_INITIALIZING error type', async function () {
            if (!mockSidecar) this.skip();

            mockSidecar.setState(MockStates.INITIALIZING);
            mockSidecar.setInitStage('loading_model');

            try {
                await testClient.searchImageAlpha9(MINIMAL_PNG_BASE64, 'visual_pages');
                assert.fail('Should have thrown');
            } catch (err) {
                assert.strictEqual(err.type, ErrorTypes.SIDECAR_INITIALIZING);
                assert.strictEqual(err.status, 503);
            }
        });

        it('should include init stage in error detail', async function () {
            if (!mockSidecar) this.skip();

            mockSidecar.setState(MockStates.INITIALIZING);
            mockSidecar.setInitStage('connecting_qdrant');

            try {
                await testClient.searchImageAlpha9(MINIMAL_PNG_BASE64, 'visual_pages');
                assert.fail('Should have thrown');
            } catch (err) {
                assert.ok(err.detail.includes('connecting_qdrant') || err.message.includes('connecting_qdrant'));
            }
        });

        it('should recover after warmup completes', async function () {
            if (!mockSidecar) this.skip();

            this.timeout(10000);

            // Start in initializing state
            mockSidecar.setState(MockStates.INITIALIZING);

            // First request should fail
            try {
                await testClient.searchImageAlpha9(MINIMAL_PNG_BASE64, 'visual_pages');
                assert.fail('Should have thrown');
            } catch (err) {
                assert.strictEqual(err.type, ErrorTypes.SIDECAR_INITIALIZING);
            }

            // Transition to healthy
            mockSidecar.setState(MockStates.HEALTHY);

            // Second request should succeed
            const result = await testClient.searchImageAlpha9(MINIMAL_PNG_BASE64, 'visual_pages');
            assert.ok(Array.isArray(result.results));
        });

    });

    // =========================================================================
    // Timeout Tests (ticket:007.2)
    // =========================================================================
    describe('Timeout Handling', function () {

        it('should timeout after 5 seconds', async function () {
            if (!mockSidecar) this.skip();

            this.timeout(15000);

            mockSidecar.setState(MockStates.TIMEOUT);

            const start = Date.now();
            try {
                await testClient.searchImageAlpha9(MINIMAL_PNG_BASE64, 'visual_pages');
                assert.fail('Should have thrown');
            } catch (err) {
                const elapsed = Date.now() - start;
                // Should timeout around 5000ms (with some tolerance)
                assert.ok(elapsed >= 4000 && elapsed <= 7000, `Elapsed: ${elapsed}ms`);
                assert.strictEqual(err.type, ErrorTypes.TIMEOUT);
            }
        });

    });

    // =========================================================================
    // Error Types Export (ticket:007.2)
    // =========================================================================
    describe('ErrorTypes Export', function () {

        it('should export all error types', function () {
            assert.strictEqual(ErrorTypes.SIDECAR_INITIALIZING, 'SIDECAR_INITIALIZING');
            assert.strictEqual(ErrorTypes.TIMEOUT, 'TIMEOUT');
            assert.strictEqual(ErrorTypes.CIRCUIT_OPEN, 'CIRCUIT_OPEN');
            assert.strictEqual(ErrorTypes.NETWORK_ERROR, 'NETWORK_ERROR');
        });

    });

});

// =========================================================================
// API Route Integration Tests
// =========================================================================
describe('Visual RAG API Route Integration', function () {
    this.timeout(10000);

    it('POST /api/visual-rag/search/visual should be accessible', async function () {
        const res = await request(app)
            .post('/api/visual-rag/search/visual')
            .send({
                image: MINIMAL_PNG_BASE64
            });

        // Should get a response (not 404)
        assert.ok(
            [200, 400, 500, 503].includes(res.status),
            `Expected valid status, got ${res.status}`
        );
    });

    it('should handle k parameter', async function () {
        const res = await request(app)
            .post('/api/visual-rag/search/visual')
            .send({
                image: MINIMAL_PNG_BASE64,
                k: 10
            });

        // Should accept k parameter without error
        assert.ok(res.status !== 400 || !res.body.error?.includes('k'));
    });

});
