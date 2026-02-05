const assert = require('node:assert');
const {
  buildProgressUpdate,
  ReprocessProgressBroker
} = require('../../services/reprocess/ReprocessProgressBroker');

describe('ReprocessProgressBroker', function () {
  it('builds normalized progress payloads with clamped percentages', function () {
    const payload = buildProgressUpdate(42, {
      stage: 'extracting',
      percentage: 140
    });

    assert.strictEqual(payload.documentId, 42);
    assert.strictEqual(payload.stage, 'extracting');
    assert.strictEqual(payload.percentage, 100);
    assert.strictEqual(payload.status, 'in_progress');
    assert.ok(payload.timestamp);
  });

  it('publishes updates to subscribers for the matching document', function () {
    const broker = new ReprocessProgressBroker();
    const received = [];

    const unsubscribe = broker.subscribe(99, (payload) => {
      received.push(payload);
    });

    broker.publish(99, { stage: 'queued' });
    broker.publish(100, { stage: 'queued' });
    broker.publish(99, { stage: 'completed' });
    unsubscribe();

    assert.strictEqual(received.length, 2);
    assert.strictEqual(received[0].stage, 'queued');
    assert.strictEqual(received[1].stage, 'completed');
    assert.strictEqual(received[1].status, 'completed');
    assert.strictEqual(received[1].percentage, 100);
  });
});
