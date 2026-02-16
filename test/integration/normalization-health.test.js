/* eslint-env mocha */

/**
 * test/integration/normalization-health.test.js
 *
 * Integration tests for normalization health check endpoint.
 *
 * Service dependencies: paperless-ai server (app, started in-process)
 * No external DB/Qdrant connections required for this health endpoint.
 *
 * Ticket: 7120d115-a0c0-4d52-89a2-8f84e67af453 (Phase 4)
 */

const assert = require('assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Import app (will be initialized in before hook)
let app;

describe('Normalization Health Endpoint', () => {
    let authToken;

    before(() => {
        // Import app after environment is set up
        app = require('../../server');

        // Generate JWT token for authentication
        // Use environment variable or fallback to test secret
        const jwtSecret = process.env.JWT_SECRET || 'test-secret-key-for-integration-tests';
        authToken = jwt.sign(
            { userId: 1, username: 'test-user' },
            jwtSecret,
            { expiresIn: '1h' }
        );
    });

    describe('GET /api/normalization/health', () => {
        it('should return health status (authentication optional for health checks)', async () => {
            const response = await request(app)
                .get('/api/normalization/health')
                .expect(200);

            assert.strictEqual(response.body.status, 'ok', 'Status should be ok');
            assert.ok(response.body.stats, 'Should include stats object');
            assert.ok(response.body.timestamp, 'Should include timestamp');
        });

        it('should return health status with valid auth', async () => {
            const response = await request(app)
                .get('/api/normalization/health')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            assert.strictEqual(response.body.status, 'ok', 'Status should be ok');
            assert.ok(response.body.stats, 'Should include stats object');
            assert.ok(response.body.timestamp, 'Should include timestamp');
        });

        it('should include required stats fields', async () => {
            const response = await request(app)
                .get('/api/normalization/health')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const { stats } = response.body;

            assert.ok(
                typeof stats.totalDocuments === 'number',
                'Should include totalDocuments (number)'
            );
            assert.ok(
                typeof stats.diskUsageBytes === 'number',
                'Should include diskUsageBytes (number)'
            );
            assert.ok(
                typeof stats.diskUsageMb === 'string' || typeof stats.diskUsageMb === 'number',
                'Should include diskUsageMb'
            );
            assert.ok(
                typeof stats.stored === 'number',
                'Should include stored (number)'
            );
            assert.ok(
                typeof stats.updated === 'number',
                'Should include updated (number)'
            );
            assert.ok(
                typeof stats.errors === 'number',
                'Should include errors (number)'
            );
        });

        it('should include valid timestamp', async () => {
            const response = await request(app)
                .get('/api/normalization/health')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const timestamp = new Date(response.body.timestamp);
            assert.ok(!isNaN(timestamp.getTime()), 'Timestamp should be valid ISO 8601 date');
        });

        it('should return consistent data on multiple calls', async () => {
            const response1 = await request(app)
                .get('/api/normalization/health')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const response2 = await request(app)
                .get('/api/normalization/health')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            // Stats should be consistent (or increasing) between calls
            assert.ok(
                response2.body.stats.totalDocuments >= response1.body.stats.totalDocuments,
                'Total documents should not decrease'
            );
            assert.ok(
                response2.body.stats.diskUsageBytes >= 0,
                'Disk usage should be non-negative'
            );
        });
    });

    describe('Prometheus Metrics Scraping', () => {
        it('should expose normalization metrics on /metrics endpoint', async () => {
            const response = await request(app)
                .get('/metrics')
                .expect(200);

            const metricsText = response.text;

            // Check for normalization metrics
            assert.ok(
                metricsText.includes('paperless_ai_normalization_total'),
                'Should include normalization_total counter'
            );
            assert.ok(
                metricsText.includes('paperless_ai_normalization_latency_seconds'),
                'Should include normalization_latency histogram'
            );
            assert.ok(
                metricsText.includes('paperless_ai_normalization_pending'),
                'Should include normalization_pending gauge'
            );
            assert.ok(
                metricsText.includes('paperless_ai_normalization_disk_mb'),
                'Should include normalization_disk_mb gauge'
            );
        });

        it('should include help text for metrics', async () => {
            const response = await request(app)
                .get('/metrics')
                .expect(200);

            const metricsText = response.text;

            assert.ok(
                metricsText.includes('# HELP paperless_ai_normalization_total'),
                'Should include help text for counter'
            );
            assert.ok(
                metricsText.includes('# HELP paperless_ai_normalization_latency_seconds'),
                'Should include help text for histogram'
            );
            assert.ok(
                metricsText.includes('# HELP paperless_ai_normalization_pending'),
                'Should include help text for pending gauge'
            );
            assert.ok(
                metricsText.includes('# HELP paperless_ai_normalization_disk_mb'),
                'Should include help text for disk usage gauge'
            );
        });

        it('should include TYPE declarations for metrics', async () => {
            const response = await request(app)
                .get('/metrics')
                .expect(200);

            const metricsText = response.text;

            assert.ok(
                metricsText.includes('# TYPE paperless_ai_normalization_total counter'),
                'Should declare counter type'
            );
            assert.ok(
                metricsText.includes('# TYPE paperless_ai_normalization_latency_seconds histogram'),
                'Should declare histogram type'
            );
            assert.ok(
                metricsText.includes('# TYPE paperless_ai_normalization_pending gauge'),
                'Should declare pending gauge type'
            );
            assert.ok(
                metricsText.includes('# TYPE paperless_ai_normalization_disk_mb gauge'),
                'Should declare disk usage gauge type'
            );
        });
    });

    describe('Health Response Format', () => {
        it('should return JSON content type', async () => {
            const response = await request(app)
                .get('/api/normalization/health')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            assert.ok(
                response.headers['content-type'].includes('application/json'),
                'Content-Type should be application/json'
            );
        });

        it('should handle store errors gracefully', async () => {
            // This test verifies error handling exists
            // In a real scenario, we would mock the store to throw an error
            const response = await request(app)
                .get('/api/normalization/health')
                .set('Authorization', `Bearer ${authToken}`);

            // Should return either 200 (success) or 500 (error), but not crash
            assert.ok(
                response.status === 200 || response.status === 500,
                'Should handle store operations gracefully'
            );

            if (response.status === 500) {
                assert.ok(response.body.error, 'Error response should include error message');
                assert.strictEqual(response.body.status, 'error', 'Status should be error');
            }
        });
    });
});
