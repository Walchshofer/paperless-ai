/* eslint-env mocha */

const assert = require('assert');
const http = require('http');
const express = require('express');
const { metricsCollector } = require('../../services/metrics/PrometheusMetrics');

describe('Phase 5 Metrics Collection', function() {
    it('should expose Prometheus metrics endpoint', function(done) {
        const app = express();
        app.get('/metrics', async (_req, res) => {
            try {
                const payload = await metricsCollector.getMetrics();
                res.setHeader('Content-Type', metricsCollector.contentType);
                res.status(200).send(payload);
            } catch (error) {
                res.status(500).send('');
            }
        });

        const server = app.listen(0, () => {
            const port = server.address().port;
            metricsCollector.recordStageLatency('integration-stage', 'TEST', 42);

            http.get(`http://127.0.0.1:${port}/metrics`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        assert.strictEqual(res.statusCode, 200);
                        assert.ok(data.includes('pipeline_stage_latency_ms'));
                        done();
                    } catch (err) {
                        done(err);
                    } finally {
                        server.close();
                    }
                });
            }).on('error', (err) => {
                server.close();
                done(err);
            });
        });
    });
});
