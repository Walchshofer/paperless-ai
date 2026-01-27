const assert = require('assert');
const { debounce } = require('../../src/islands/VisualOverlaysIsland.tsx');

describe('debounce', function() {
  it('debounces rapid calls into single call', function(done) {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 50);
    fn(); fn(); fn();
    setTimeout(() => {
      assert.strictEqual(calls, 1);
      done();
    }, 120);
  });
});