const assert = require('assert');
const { getFallbackPromptId } = require('../../services/guidance');
const { promptRegistry } = require('../../services/prompts/PromptRegistry');

describe('Guidance fallback mappings', function () {
  it('includes normalization_geometry -> SYS_ROUTER_V1 and prompt is registered', function () {
    const promptId = getFallbackPromptId('normalization_geometry');
    assert.strictEqual(promptId, 'SYS_ROUTER_V1');

    const prompt = promptRegistry.get(promptId);
    assert.ok(prompt, `Expected prompt ${promptId} to be registered`);
  });
});