const assert = require('assert');
const config = require('../../config/config');

describe('Config.getRaw PROMPT_TAGS integration', () => {
  it('exposes getRaw and returns a deep-copied plain config object', () => {
    assert.strictEqual(typeof config.getRaw, 'function', 'config.getRaw should be a function');

    const plain = config.getRaw();
    assert.ok(plain && typeof plain === 'object', 'getRaw() should return a plain object copy of the config');

    // Ensure plain copy includes expected keys like modelAliases
    assert.ok(plain.modelAliases && typeof plain.modelAliases === 'object', 'plain config copy should include modelAliases object');

    // Verify enumeration works on the plain copy
    const keys = Object.keys(plain.modelAliases);
    assert.ok(keys.includes('llava-med'), 'modelAliases should include llava-med in plain copy');
  });
});