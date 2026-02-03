/**
 * test/unit/normalizationMetrics.test.js
 *
 * Unit tests for normalization Prometheus metrics.
 *
 * Ticket: 7120d115-a0c0-4d52-89a2-8f84e67af453 (Phase 4)
 */

const assert = require('assert');
const client = require('prom-client');

describe('Normalization Metrics', () => {
    let metrics;

    before(() => {
        // Import metrics module (registers metrics with default registry)
        metrics = require('../../services/metrics/normalizationMetrics');
    });

    after(() => {
        // Clear registry after tests
        client.register.clear();
    });

    describe('Metrics Registration', () => {
        it('should export normalizationTotal counter', () => {
            assert.ok(metrics.normalizationTotal, 'normalizationTotal should exist');
            assert.strictEqual(
                metrics.normalizationTotal.constructor.name,
                'Counter',
                'normalizationTotal should be a Counter'
            );
        });

        it('should export normalizationLatency histogram', () => {
            assert.ok(metrics.normalizationLatency, 'normalizationLatency should exist');
            assert.strictEqual(
                metrics.normalizationLatency.constructor.name,
                'Histogram',
                'normalizationLatency should be a Histogram'
            );
        });

        it('should export normalizationPending gauge', () => {
            assert.ok(metrics.normalizationPending, 'normalizationPending should exist');
            assert.strictEqual(
                metrics.normalizationPending.constructor.name,
                'Gauge',
                'normalizationPending should be a Gauge'
            );
        });

        it('should export normalizationDiskUsage gauge', () => {
            assert.ok(metrics.normalizationDiskUsage, 'normalizationDiskUsage should exist');
            assert.strictEqual(
                metrics.normalizationDiskUsage.constructor.name,
                'Gauge',
                'normalizationDiskUsage should be a Gauge'
            );
        });
    });

    describe('Counter Operations', () => {
        it('should increment normalizationTotal counter', async () => {
            metrics.normalizationTotal.labels({ status: 'success', trigger: 'manual' }).inc();

            // Verify counter was incremented by checking registry output
            const metricsOutput = await client.register.metrics();
            assert.ok(
                metricsOutput.includes('paperless_ai_normalization_total'),
                'Counter should be registered'
            );
            assert.ok(
                metricsOutput.includes('status="success"'),
                'Counter should have success label'
            );
            assert.ok(
                metricsOutput.includes('trigger="manual"'),
                'Counter should have manual label'
            );
        });

        it('should support different label combinations', async () => {
            metrics.normalizationTotal.labels({ status: 'success', trigger: 'pipeline' }).inc();
            metrics.normalizationTotal.labels({ status: 'failed', trigger: 'batch' }).inc();

            const metricsOutput = await client.register.metrics();

            assert.ok(
                metricsOutput.includes('status="success"') && metricsOutput.includes('trigger="pipeline"'),
                'success/pipeline counter should be incremented'
            );
            assert.ok(
                metricsOutput.includes('status="failed"') && metricsOutput.includes('trigger="batch"'),
                'failed/batch counter should be incremented'
            );
        });
    });

    describe('Histogram Operations', () => {
        it('should record normalizationLatency observations', async () => {
            metrics.normalizationLatency.labels({ stage: 'analysis' }).observe(1.5);
            metrics.normalizationLatency.labels({ stage: 'persistence' }).observe(0.8);

            const metricsOutput = await client.register.metrics();
            assert.ok(
                metricsOutput.includes('paperless_ai_normalization_latency_seconds'),
                'Histogram should be registered'
            );
        });

        it('should support multiple stages', async () => {
            metrics.normalizationLatency.labels({ stage: 'analysis' }).observe(2.0);
            metrics.normalizationLatency.labels({ stage: 'transformation' }).observe(1.2);
            metrics.normalizationLatency.labels({ stage: 'persistence' }).observe(0.5);

            const metricsOutput = await client.register.metrics();
            assert.ok(
                metricsOutput.includes('stage="analysis"'),
                'Should include analysis stage'
            );
            assert.ok(
                metricsOutput.includes('stage="transformation"'),
                'Should include transformation stage'
            );
            assert.ok(
                metricsOutput.includes('stage="persistence"'),
                'Should include persistence stage'
            );
        });
    });

    describe('Gauge Operations', () => {
        it('should set normalizationPending gauge', async () => {
            metrics.normalizationPending.set(5);
            const metricsOutput = await client.register.metrics();
            assert.ok(
                metricsOutput.includes('paperless_ai_normalization_pending 5'),
                'Gauge should be set to 5'
            );
        });

        it('should update normalizationPending gauge', async () => {
            metrics.normalizationPending.set(10);
            let metricsOutput = await client.register.metrics();
            assert.ok(
                metricsOutput.includes('paperless_ai_normalization_pending 10'),
                'Gauge should be set to 10'
            );

            metrics.normalizationPending.set(3);
            metricsOutput = await client.register.metrics();
            assert.ok(
                metricsOutput.includes('paperless_ai_normalization_pending 3'),
                'Gauge should be updated to 3'
            );
        });

        it('should set normalizationDiskUsage gauge', async () => {
            metrics.normalizationDiskUsage.set(15.3);
            const metricsOutput = await client.register.metrics();
            assert.ok(
                metricsOutput.includes('paperless_ai_normalization_disk_mb 15.3'),
                'Gauge should be set to 15.3'
            );
        });
    });

    describe('Metric Names', () => {
        it('should use paperless_ai_ prefix for all metrics', async () => {
            const metricsOutput = await client.register.metrics();

            assert.ok(
                metricsOutput.includes('paperless_ai_normalization_total'),
                'Counter should use paperless_ai_ prefix'
            );
            assert.ok(
                metricsOutput.includes('paperless_ai_normalization_latency_seconds'),
                'Histogram should use paperless_ai_ prefix'
            );
            assert.ok(
                metricsOutput.includes('paperless_ai_normalization_pending'),
                'Pending gauge should use paperless_ai_ prefix'
            );
            assert.ok(
                metricsOutput.includes('paperless_ai_normalization_disk_mb'),
                'Disk usage gauge should use paperless_ai_ prefix'
            );
        });
    });
});
