const assert = require('assert');
const ModelResolutionService = require('../../services/ModelResolutionService');

const SvcClass = ModelResolutionService.ModelResolutionService;

describe('ModelResolutionService.getExpertModels', function () {
  it('uses config.getRaw when available', function () {
    const svc = new SvcClass({ config: {
      getRaw: function (key) {
        if (key === 'expertModels') return { financial: { analysis: 'fino1-8b' } };
        return undefined;
      }
    } });

    const models = svc.getExpertModels();
    assert.ok(Array.isArray(models));
    const found = models.some(m => m.category === 'financial' && m.role === 'analysis' && m.model === 'fino1-8b');
    assert.ok(found, 'Expected to find the provided expert model in the resolved list');
  });

  it('falls back to __getOriginal when getRaw returns undefined', function () {
    const svc = new SvcClass({ config: {
      getRaw: function () { return undefined; },
      __getOriginal: function (key) {
        if (key === 'expertModels') return { legal: { analysis: 'gpt-oss' } };
        return undefined;
      }
    } });

    const models = svc.getExpertModels();

    assert.ok(Array.isArray(models));
    const found = models.some(m => m.category === 'legal' && m.role === 'analysis' && m.model === 'gpt-oss');
    assert.ok(found, 'Expected to find the provided expert model in the resolved list');
  });

  it('falls back to config.expertModels when raw accessors unavailable', function () {
    const svc = new SvcClass({ config: { expertModels: { medical: { vision: 'llava-med-v1.6' } } } });

    const models = svc.getExpertModels();

    assert.ok(Array.isArray(models));
    const found = models.some(m => m.category === 'medical' && m.role === 'vision' && m.model === 'llava-med-v1.6');
    assert.ok(found, 'Expected to find the provided expert model in the resolved list');
  });
});