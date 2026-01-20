const assert = require('assert');
const feedbackService = require('../../services/feedback/FeedbackService');

describe('FeedbackService.recordGranularFeedback', function() {
  it('should be a function and return a results object', async function() {
    assert.strictEqual(typeof feedbackService.recordGranularFeedback, 'function');
    const res = await feedbackService.recordGranularFeedback(1, []);
    assert.ok(res && typeof res === 'object');
  });

  it('should inject requestId into event context when missing', async function() {
    const inserted = [];
    // Mock client that records queries
    const fakeClient = {
      query: async (sql, params) => {
        if (!Array.isArray(params)) {
          return { rows: [] };
        }
        // Capture the context param which is last
        const ctxJson = params[6];
        inserted.push(JSON.parse(ctxJson));
        // Simulate returning an id
        return { rows: [{ id: 999 }] };
      },
      release: () => {},
    };

    const events = [{ event_type: 'correction', field_name: 'title', context: { note: 'x' } }];
    const res = await feedbackService.recordGranularFeedback(1, events, { requestId: 'test-req-id', client: fakeClient });
    assert.ok(res && res.inserted && res.inserted.length === 1, 'should insert one event');
    assert.strictEqual(inserted.length, 1);
    assert.strictEqual(inserted[0].request_id, 'test-req-id');
  });
});