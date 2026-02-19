const assert = require('assert');
const visualRagRouter = require('../../routes/api/visual-rag');
const visualRagClient = require('../../services/visual-rag-client');
const paperlessService = require('../../services/paperlessService');

function getNormalizedHandler() {
  const layer = visualRagRouter.stack.find(
    (item) =>
      item.route &&
      item.route.path === '/normalized/:docId' &&
      item.route.methods.get
  );
  assert.ok(layer, 'expected /normalized/:docId route');
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function createMockResponse() {
  let statusCode = 200;
  let jsonBody = null;
  let sentBody = null;
  const headers = {};

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      jsonBody = payload;
      return this;
    },
    setHeader(key, value) {
      headers[String(key).toLowerCase()] = value;
    },
    send(payload) {
      sentBody = payload;
      return this;
    },
  };

  return {
    res,
    getStatusCode: () => statusCode,
    getJsonBody: () => jsonBody,
    getSentBody: () => sentBody,
    getHeaders: () => headers,
  };
}

describe('Visual RAG route - GET /normalized/:docId', function () {
  let originalGetDocumentMetadata;
  let originalDownloadOriginalDocument;
  let originalDownloadDocument;
  let originalIsAvailableAsync;
  let originalRenderBuffer;

  beforeEach(() => {
    originalGetDocumentMetadata = paperlessService.getDocumentMetadata;
    originalDownloadOriginalDocument = paperlessService.downloadOriginalDocument;
    originalDownloadDocument = paperlessService.downloadDocument;
    originalIsAvailableAsync = visualRagClient.pdfRenderer.isAvailableAsync;
    originalRenderBuffer = visualRagClient.pdfRenderer.renderBuffer;
  });

  afterEach(() => {
    paperlessService.getDocumentMetadata = originalGetDocumentMetadata;
    paperlessService.downloadOriginalDocument = originalDownloadOriginalDocument;
    paperlessService.downloadDocument = originalDownloadDocument;
    visualRagClient.pdfRenderer.isAvailableAsync = originalIsAvailableAsync;
    visualRagClient.pdfRenderer.renderBuffer = originalRenderBuffer;
  });

  it('returns 415 for unsupported mime types', async function () {
    const handler = getNormalizedHandler();
    paperlessService.getDocumentMetadata = async () => ({
      mime_type: 'text/plain',
    });

    const recorder = createMockResponse();
    await handler(
      { params: { docId: '92' }, query: {} },
      recorder.res
    );

    assert.strictEqual(recorder.getStatusCode(), 415);
    assert.strictEqual(
      recorder.getJsonBody().error,
      'Document type not supported for visual rendering'
    );
  });

  it('does not require poppler availability for image documents', async function () {
    const handler = getNormalizedHandler();
    let availabilityChecks = 0;

    paperlessService.getDocumentMetadata = async () => ({
      mime_type: 'image/png',
    });
    visualRagClient.pdfRenderer.isAvailableAsync = async () => {
      availabilityChecks += 1;
      return false;
    };
    paperlessService.downloadOriginalDocument = async () =>
      Buffer.from('89504E470D0A1A0A', 'hex');
    paperlessService.downloadDocument = async () => null;
    visualRagClient.pdfRenderer.renderBuffer = async () => ([
      {
        page: 1,
        base64: Buffer.from('pixel').toString('base64'),
        format: 'png',
      },
    ]);

    const recorder = createMockResponse();
    await handler(
      { params: { docId: '101' }, query: { page: '1' } },
      recorder.res
    );

    assert.strictEqual(availabilityChecks, 0);
    assert.strictEqual(recorder.getStatusCode(), 200);
    assert.strictEqual(recorder.getHeaders()['content-type'], 'image/png');
    assert.ok(Buffer.isBuffer(recorder.getSentBody()));
  });

  it('returns 404 when requested page is unavailable', async function () {
    const handler = getNormalizedHandler();

    paperlessService.getDocumentMetadata = async () => ({
      mime_type: 'application/pdf',
    });
    visualRagClient.pdfRenderer.isAvailableAsync = async () => true;
    paperlessService.downloadOriginalDocument = async () =>
      Buffer.from('%PDF-1.7');
    paperlessService.downloadDocument = async () => null;
    visualRagClient.pdfRenderer.renderBuffer = async () => ([
      {
        page: 1,
        base64: Buffer.from('page1').toString('base64'),
        format: 'png',
      },
    ]);

    const recorder = createMockResponse();
    await handler(
      { params: { docId: '303' }, query: { page: '2' } },
      recorder.res
    );

    assert.strictEqual(recorder.getStatusCode(), 404);
    assert.strictEqual(
      recorder.getJsonBody().error,
      'Requested page is unavailable'
    );
  });
});
