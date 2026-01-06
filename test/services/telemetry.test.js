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

const documentModel = require('../../models/document');

describe('Feedback model', function() {
    it('can insert and fetch pending feedback', async function() {
        // This test assumes a test DB is available and migrations applied
        const row = await documentModel.insertFeedback({
            doc_id: 999999,
            user_id: null,
            event_type: 'test_event',
            field_name: 'unit_test',
            original_value: 'old',
            corrected_value: 'new',
            context: { reason: 'unit test' }
        });

        assert.ok(row.id, 'Inserted row should have id');

        const pending = await documentModel.getPendingFeedback(10);
        const found = pending.find(r => r.id === row.id);
        assert.ok(found, 'Inserted feedback should appear in pending');

        const processed = await documentModel.markFeedbackProcessed([row.id]);
        assert.strictEqual(processed, 1, 'Should mark one row as processed');
    });
});
