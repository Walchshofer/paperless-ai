const assert = require('assert');
const documentsRouter = require('../../routes/api/documents');
const paperlessService = require('../../services/paperlessService');
const {
  pdfRenderer,
} = require('../../services/visual-rag-client/PDFRenderer');

function getPreviewImageHandler() {
  const layer = documentsRouter.stack.find(
    (item) =>
      item.route &&
      item.route.path === '/:id/preview-image' &&
      item.route.methods.get
  );
  assert.ok(layer, 'expected /:id/preview-image route');
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function createMockResponse() {
  let statusCode = 200;
  let jsonBody = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      jsonBody = payload;
      return this;
    },
  };

  return {
    res,
    getStatusCode: () => statusCode,
    getJsonBody: () => jsonBody,
  };
}

describe('Documents route - GET /:id/preview-image', function () {
  let originalGetDocument;
  let originalRenderBuffer;
  let originalAccess;
  let originalAxiosGet;

  beforeEach(() => {
    originalGetDocument = paperlessService.getDocument;
    originalRenderBuffer = pdfRenderer.renderBuffer;
    originalAccess = require('fs').promises.access;
    originalAxiosGet = require('axios').get;
  });

  afterEach(() => {
    paperlessService.getDocument = originalGetDocument;
    pdfRenderer.renderBuffer = originalRenderBuffer;
    require('fs').promises.access = originalAccess;
    require('axios').get = originalAxiosGet;
  });

  it('returns 415 for unsupported image mime types', async function () {
    const handler = getPreviewImageHandler();
    let renderCalls = 0;

    paperlessService.getDocument = async () => ({
      id: 42,
      mime_type: 'image/svg+xml',
    });
    require('fs').promises.access = async () => {
      throw new Error('ENOENT');
    };
    pdfRenderer.renderBuffer = async () => {
      renderCalls += 1;
      return [];
    };

    const recorder = createMockResponse();
    await handler({ params: { id: '42' } }, recorder.res);

    assert.strictEqual(recorder.getStatusCode(), 415);
    assert.strictEqual(renderCalls, 0);
    assert.strictEqual(
      recorder.getJsonBody().error,
      'Document type not supported for visual preview'
    );
  });

  it('returns image data using renderer-reported format', async function () {
    const handler = getPreviewImageHandler();

    paperlessService.getDocument = async () => ({
      id: 77,
      mime_type: 'image/tiff',
    });
    require('fs').promises.access = async () => {
      throw new Error('ENOENT');
    };
    require('axios').get = async () => ({
      data: Buffer.from('49492A0008000000', 'hex'),
    });
    pdfRenderer.renderBuffer = async () => ([
      {
        page: 1,
        base64: Buffer.from('tiff-image').toString('base64'),
        format: 'tiff',
      },
    ]);

    const recorder = createMockResponse();
    await handler({ params: { id: '77' } }, recorder.res);

    assert.strictEqual(recorder.getStatusCode(), 200);
    assert.strictEqual(recorder.getJsonBody().success, true);
    assert.ok(
      recorder.getJsonBody().image_data.startsWith('data:image/tiff;base64,')
    );
  });
});
