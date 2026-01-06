const assert = require('assert');
const feedbackService = require('../../services/feedback/FeedbackService');

describe('FeedbackService.recordGranularFeedback', function() {
  it('should be a function and return a results object', async function() {
    assert.strictEqual(typeof feedbackService.recordGranularFeedback, 'function');
    const res = await feedbackService.recordGranularFeedback(1, []);
    assert.ok(res && typeof res === 'object');
  });
});