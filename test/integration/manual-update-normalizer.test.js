/* eslint-env mocha */

const assert = require('assert');
const { normalizeManualUpdatePayload } = require('../../services/manualUpdateNormalizer');

describe('Manual Update Normalizer', function () {
  it('maps documentType/correspondent and strips unsupported fields', async function () {
    const stubPaperless = {
      getOrCreateDocumentType: async (name) => ({ id: 42, name }),
      getOrCreateCorrespondent: async (name) => ({ id: 7, name })
    };
    const stubLogger = { debug: () => {} };

    const updates = {
      title: 'Test Doc',
      content: 'Should be removed',
      documentType: 'Invoice',
      correspondent: { name: 'Acme Co' }
    };

    const normalized = await normalizeManualUpdatePayload(updates, 'req-1', {
      paperlessService: stubPaperless,
      logger: stubLogger
    });

    assert.strictEqual(normalized.content, undefined);
    assert.strictEqual(normalized.documentType, undefined);
    assert.strictEqual(normalized.document_type, 42);
    assert.strictEqual(normalized.correspondent, 7);
    assert.strictEqual(normalized.title, 'Test Doc');
  });
});
