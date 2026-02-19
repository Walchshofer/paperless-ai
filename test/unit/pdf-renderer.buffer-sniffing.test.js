const assert = require('assert');
const {
  PDFRenderer,
} = require('../../services/visual-rag-client/PDFRenderer');

describe('PDFRenderer buffer sniffing', function () {
  let renderer;

  beforeEach(() => {
    renderer = new PDFRenderer();
  });

  it('treats TIFF buffers as single-page images', async function () {
    const tiffHeader = Buffer.from('49492A0008000000', 'hex');
    const images = await renderer.renderBuffer(tiffHeader, {
      maxPages: 1,
      docId: 'tiff-probe',
    });

    assert.strictEqual(images.length, 1);
    assert.strictEqual(images[0].page, 1);
    assert.strictEqual(images[0].format, 'tiff');
    assert.strictEqual(images[0].base64, tiffHeader.toString('base64'));
  });

  it('rejects RIFF payloads that are not WEBP', async function () {
    const waveHeader = Buffer.from(
      '524946460000000057415645666d7420',
      'hex'
    );

    await assert.rejects(
      () =>
        renderer.renderBuffer(waveHeader, {
          maxPages: 1,
          docId: 'riff-wave-probe',
        }),
      /not a valid PDF/i
    );
  });

  it('treats WEBP buffers as single-page images', async function () {
    const webpHeader = Buffer.from('524946460000000057454250', 'hex');
    const images = await renderer.renderBuffer(webpHeader, {
      maxPages: 1,
      docId: 'webp-probe',
    });

    assert.strictEqual(images.length, 1);
    assert.strictEqual(images[0].format, 'webp');
    assert.strictEqual(images[0].base64, webpHeader.toString('base64'));
  });
});
