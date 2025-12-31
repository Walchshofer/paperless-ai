const assert = require('assert');
const TelemetryCollector = require('../../services/TelemetryCollector');

describe('TelemetryCollector normalization metrics', function () {
  it('setNormalization records metadata and getters return expected rates', function () {
    const t = new TelemetryCollector('doc-1');
    const meta = {
      requested: 2,
      executed: 1,
      succeeded: 1,
      changes_detected: true,
      reingested: true,
      actions_applied: ['rotate'],
      warnings: ['low_conf']
    };

    t.setNormalization(meta);

    assert.strictEqual(t.telemetry.normalization.requested, 2);
    assert.strictEqual(t.telemetry.normalization.executed, 1);
    assert.strictEqual(t.telemetry.normalization.succeeded, 1);
    assert.strictEqual(t.getNormalizationRate(), 0.5);
    assert.strictEqual(t.getChangeDetectionRate(), 1);

    // Edge cases
    const t2 = new TelemetryCollector('doc-2');
    t2.setNormalization({ requested: 0, executed: 0, changes_detected: false });
    assert.strictEqual(t2.getNormalizationRate(), 0);
    assert.strictEqual(t2.getChangeDetectionRate(), 0);
  });
});