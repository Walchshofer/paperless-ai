const assert = require('assert');
const config = require('../../config/config');
const { resolveModelName } = require('../../services/utils/modelResolver');

describe('Config.getRaw / __getOriginal integration', () => {
  it('exposes getRaw and returns plain modelAliases object', () => {
    assert.strictEqual(typeof config.getRaw, 'function');
    const aliases = config.getRaw('modelAliases');
    assert.ok(aliases && typeof aliases === 'object');
    assert.strictEqual(aliases['llava-med'], 'llava-med-v1.6');
  });

  it('resolveModelName resolves aliases regardless of case', () => {
    assert.strictEqual(resolveModelName('llava-med'), 'llava-med-v1.6');
    assert.strictEqual(resolveModelName('LLAVA-MED'), 'llava-med-v1.6');
    assert.strictEqual(resolveModelName('llava-med-v1.5'), 'llava-med-v1.6');
  });
});