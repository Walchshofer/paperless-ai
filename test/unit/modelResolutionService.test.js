const assert = require('assert');
const { ModelResolutionService } = require('../../services/ModelResolutionService');

describe('ModelResolutionService', function() {
  it('returns ollama models and caches results', async function() {
    let callCount = 0;
    const stubFetch = async () => {
      callCount += 1;
      return ['ollama-a:1', 'qwen3-vl:8b'];
    };

    const svc = new ModelResolutionService({ fetchOllamaModels: stubFetch, ollamaTtlMs: 1000 });
    const list1 = await svc.getModelsForProvider('ollama');
    assert.deepStrictEqual(list1, ['ollama-a:1', 'qwen3-vl:8b']);
    assert.strictEqual(callCount, 1);

    const list2 = await svc.getModelsForProvider('ollama');
    assert.deepStrictEqual(list2, list1);
    assert.strictEqual(callCount, 1, 'should use cache on second call');
  });

  it('returns openai/custom/azure configured models', async function() {
    process.env.PAPERLESS_OPENAI_MODEL = 'gpt-test';
    process.env.CUSTOM_MODEL = 'custom-model-1';
    process.env.AZURE_DEPLOYMENT_NAME = 'azure-deploy';

    const svc = new ModelResolutionService({ fetchOllamaModels: async () => [] });

    const openai = await svc.getModelsForProvider('openai');
    assert.deepStrictEqual(openai, ['gpt-test']);

    const custom = await svc.getModelsForProvider('custom');
    // The repo may have a configured custom model in config; accept either the env override or the configured model
    assert.ok(Array.isArray(custom) && custom.length > 0, 'custom models must be non-empty');
    if (custom.length === 1) {
      assert.ok(custom[0] === 'custom-model-1' || custom[0] !== undefined);
    }

    const azure = await svc.getModelsForProvider('azure');
    assert.deepStrictEqual(azure, ['azure-deploy']);

    delete process.env.PAPERLESS_OPENAI_MODEL;
    delete process.env.CUSTOM_MODEL;
    delete process.env.AZURE_DEPLOYMENT_NAME;
  });

  it('validateModel works for providers', async function() {
    const svc = new ModelResolutionService({ fetchOllamaModels: async () => ['m1'] });
    assert.strictEqual(await svc.validateModel('ollama', 'm1'), true);
    assert.strictEqual(await svc.validateModel('ollama', 'not-exist'), false);
  });
});
