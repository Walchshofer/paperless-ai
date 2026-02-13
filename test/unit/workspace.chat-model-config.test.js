/* eslint-env mocha */
const assert = require('assert');

const workspaceRouter = require('../../routes/workspace');

describe('workspace chat model config builder', () => {
  it('builds provider map and current provider for non-ollama runtime', async () => {
    const resolver = {
      async getAllModels() {
        return {
          ollama: ['llama3.1:8b'],
          openai: ['gpt-4o-mini'],
          azure: ['azure-gpt4'],
        };
      },
      getExpertModels() {
        return [];
      }
    };

    const config = await workspaceRouter._buildChatModelConfig({
      resolver,
      runtimeConfig: { aiProvider: 'openai' },
      env: {}
    });

    assert.deepStrictEqual(config.providers.openai, ['gpt-4o-mini', 'gpt-4']);
    assert.deepStrictEqual(config.providers.ollama, ['llama3.1:8b']);
    assert.strictEqual(config.currentProvider, 'openai');
    assert.strictEqual(config.defaultModels.openai, 'gpt-4');
  });

  it('ensures current provider key exists when discovery is empty', async () => {
    const resolver = {
      async getAllModels() {
        return {};
      },
      getExpertModels() {
        return [];
      }
    };

    const config = await workspaceRouter._buildChatModelConfig({
      resolver,
      runtimeConfig: { aiProvider: 'custom' },
      env: {}
    });

    assert.ok(config.providers.custom);
    assert.deepStrictEqual(config.providers.custom, []);
    assert.strictEqual(config.currentProvider, 'custom');
  });

  it('normalizes expert models into chat contract shape', async () => {
    const resolver = {
      async getAllModels() {
        return { openai: ['gpt-4o-mini'] };
      },
      getExpertModels() {
        return [
          { category: 'financial', role: 'analysis', model: 'fino1-8b' },
          { category: 'financial', role: 'analysis', model: 'fino1-8b' },
          { category: 'medical', role: 'vision', model: 'llava-med-v1.6' }
        ];
      }
    };

    const config = await workspaceRouter._buildChatModelConfig({
      resolver,
      runtimeConfig: { aiProvider: 'openai' },
      env: {}
    });

    assert.strictEqual(config.expertModels.length, 2);
    assert.deepStrictEqual(config.expertModels[0], {
      model: 'fino1-8b',
      label: 'financial · analysis',
      category: 'financial'
    });
  });
});
