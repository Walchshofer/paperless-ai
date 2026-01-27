const assert = require('assert');
const TextRagCircuitBreaker = require('../../services/textRagCircuitBreaker');

describe('TextRagCircuitBreaker', function() {
  it('opens after threshold failures and resets after timeout', async function() {
    this.timeout(5000);
    const cb = new TextRagCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 200 });

    // helper that always rejects
    const failFn = async () => { throw new Error('fail'); };

    // Trigger failures
    for (let i = 0; i < 3; i++) {
      try { await cb.execute(failFn); } catch (e) { /* ignore */ }
    }

    assert.strictEqual(cb.getState(), 'OPEN');

    // while open, execute should immediately reject
    try {
      await cb.execute(async () => 'ok');
      assert.fail('Expected execution to be rejected when OPEN');
    } catch (e) {
      assert.ok(e.message.includes('Circuit is OPEN'));
    }

    // wait for reset timeout
    await new Promise(r => setTimeout(r, 300));
    assert.strictEqual(cb.getState(), 'HALF_OPEN');

    // on success, should close
    const result = await cb.execute(async () => 'success');
    assert.strictEqual(result, 'success');
    assert.strictEqual(cb.getState(), 'CLOSED');
  });

  it('half-open failure returns to open', async function() {
    const cb = new TextRagCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100 });
    const failFn = async () => { throw new Error('fail'); };

    for (let i = 0; i < 2; i++) {
      try { await cb.execute(failFn); } catch (e) { }
    }
    assert.strictEqual(cb.getState(), 'OPEN');

    await new Promise(r => setTimeout(r, 150));
    assert.strictEqual(cb.getState(), 'HALF_OPEN');

    // now fail in half-open -> back to open
    try { await cb.execute(failFn); } catch (e) { }
    assert.strictEqual(cb.getState(), 'OPEN');
  });
});
