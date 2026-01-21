const assert = require('assert');
const { validateInternalMetricsConfig } = require('../../metrics/validateInternalMetricsConfig');

describe('metrics/validateInternalMetricsConfig', function () {
  afterEach(() => {
    delete process.env.METRICS_INTERNAL_ONLY;
    delete process.env.METRICS_ALLOWED_CIDRS;
  });

  it('should succeed when METRICS_INTERNAL_ONLY is false', function () {
    process.env.METRICS_INTERNAL_ONLY = 'false';
    assert.strictEqual(validateInternalMetricsConfig(), true);
  });

  it('should throw when METRICS_INTERNAL_ONLY is true and METRICS_ALLOWED_CIDRS missing', function () {
    process.env.METRICS_INTERNAL_ONLY = 'true';
    delete process.env.METRICS_ALLOWED_CIDRS;
    assert.throws(() => validateInternalMetricsConfig(), /Startup failure: METRICS_INTERNAL_ONLY=true/);
  });

  it('should throw when invalid CIDR is provided', function () {
    process.env.METRICS_INTERNAL_ONLY = 'true';
    process.env.METRICS_ALLOWED_CIDRS = 'not-a-cidr';
    assert.throws(() => validateInternalMetricsConfig(), /contains invalid IP|invalid CIDR/);
  });

  it('should succeed with valid CIDR', function () {
    process.env.METRICS_INTERNAL_ONLY = 'true';
    process.env.METRICS_ALLOWED_CIDRS = '127.0.0.1,172.18.0.0/16';
    assert.strictEqual(validateInternalMetricsConfig(), true);
  });
});
