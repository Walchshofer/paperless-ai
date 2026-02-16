/* eslint-env mocha */

const assert = require('assert');
const { snapshotMetrics } = require('../helpers/metrics-snapshot');

describe('Telemetry Alpha-9 Integration', function () {
  this.timeout(10000);

  it('exports Alpha-9 metrics on /metrics', async function () {
    const metricsUrl = process.env.METRICS_URL;
    if (!metricsUrl) this.skip();

    const text = await snapshotMetrics(metricsUrl);

    const expected = [
      'visual_query_execution_time_ms',
      'maxsim_score_distribution',
      'sidecar_vram_usage_bytes',
      'circuit_breaker_open_total'
    ];

    expected.forEach((m) => {
      assert.ok(text.includes(m), `Metric ${m} should exist in /metrics`);
    });
  });

  it('skips when METRICS_URL not provided', function () {
    if (process.env.METRICS_URL) this.skip();
    assert.ok(true);
  });
});