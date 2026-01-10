/* eslint-env mocha */
const assert = require('assert');
const { buildVisOcrMetadata } = require('../../services/experts/utils/ocrMetadata');

describe('OCR Metadata - translation disabled', function() {
  it('does not attempt translation when includeTranslations is false', async function() {
    const translator = {
      async translate() {
        throw new Error('Translator should not be called');
      }
    };

    const res = await buildVisOcrMetadata('Hello world', 'en', translator, { includeTranslations: false });
    assert.strictEqual(res.metadata.translationAttempted, false);
    assert.strictEqual(res.metadata.translated, false);
  });
});
