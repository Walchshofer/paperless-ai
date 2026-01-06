const assert = require('assert');
const { snapshotMetrics } = require('../helpers/metrics-snapshot');

describe('Telemetry checks (integration)', function() {
  it('should fetch /metrics and include feedback_ingest counter', async function() {
    const metricsUrl = process.env.METRICS_URL;
    if (!metricsUrl) this.skip();
    const text = await snapshotMetrics(metricsUrl);
    assert.ok(text.includes('feedback_ingest'), 'feedback_ingest metric not found');
  });
});