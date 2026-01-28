const assert = require('assert');
const chatService = require('../../services/chatService');

describe('ChatService text-rag status', function () {
  it('returns status object with available boolean and circuitBreakerState string', function () {
    const status = chatService.getTextRagStatus();
    assert.strictEqual(typeof status.available, 'boolean');
    assert.strictEqual(typeof status.circuitBreakerState, 'string');
  });
});