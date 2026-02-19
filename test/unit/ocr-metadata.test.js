
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

  it('keeps per-page VIS OCR payload in metadata output', async function() {
    const pageTexts = [
      { pageNumber: 1, text: 'Page one', success: true },
      { pageNumber: 2, text: '', success: false }
    ];

    const res = await buildVisOcrMetadata('Combined OCR', 'en', null, {
      includeTranslations: false,
      pageTexts
    });

    assert.ok(Array.isArray(res.vis_ocr_pages));
    assert.strictEqual(res.vis_ocr_pages.length, 2);
    assert.strictEqual(res.vis_ocr_pages[0].pageNumber, 1);
    assert.strictEqual(res.vis_ocr_pages[0].text, 'Page one');
    assert.strictEqual(res.vis_ocr_pages[1].success, false);
    assert.strictEqual(res.metadata.pageCount, 2);
  });
});
