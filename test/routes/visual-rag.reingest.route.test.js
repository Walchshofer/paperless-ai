const assert = require('assert');
const visualRagRouter = require('../../routes/api/visual-rag');
const visualRagClient = require('../../services/visual-rag-client');
const paperlessService = require('../../services/paperlessService');

describe('Visual RAG route - POST /reingest/:docId', function () {
  it('forces visual reingestion for a document', async function () {
    const layer = visualRagRouter.stack.find(
      (item) =>
        item.route &&
        item.route.path === '/reingest/:docId' &&
        item.route.methods.post
    );
    assert.ok(layer, 'expected /reingest/:docId route');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    const originalGetDocumentMetadata = paperlessService.getDocumentMetadata;
    const originalDownloadDocument = paperlessService.downloadDocument;
    const originalRenderBuffer = visualRagClient.pdfRenderer.renderBuffer;
    const originalDeleteByDocId =
      visualRagClient.visualOverlayRepository.deleteByDocId;
    const originalIngestDocument = visualRagClient.ingestionManager.ingestDocument;
    const originalHasOverlays = visualRagClient.visualOverlayRepository.hasOverlays;

    let deletedDocId = null;
    let ingestedDocId = null;

    paperlessService.getDocumentMetadata = async () => ({
      title: 'Test Doc',
      tags: [{ name: 'finance' }],
      archive_file_name: 'x/y.pdf',
    });
    paperlessService.downloadDocument = async () => Buffer.from('pdf');
    visualRagClient.pdfRenderer.renderBuffer = async () => [
      { base64: 'page1' },
      { base64: 'page2' },
    ];
    visualRagClient.visualOverlayRepository.deleteByDocId = async (docId) => {
      deletedDocId = docId;
    };
    visualRagClient.visualOverlayRepository.hasOverlays = async () => {
      throw new Error('hasOverlays should not run for forced reingest');
    };
    visualRagClient.ingestionManager.ingestDocument = async (docId) => {
      ingestedDocId = docId;
      return {
        overlayExtraction: {
          overlayCount: 7,
          domain: 'financial',
        },
      };
    };

    let statusCode = 200;
    let responseBody = null;
    const req = { params: { docId: '77' }, body: {} };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        responseBody = payload;
        return this;
      },
    };

    try {
      await handler(req, res);
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(responseBody.success, true);
      assert.strictEqual(responseBody.docId, 77);
      assert.strictEqual(deletedDocId, 77);
      assert.strictEqual(ingestedDocId, 77);
      assert.strictEqual(responseBody.overlayCount, 7);
      assert.strictEqual(responseBody.pagesProcessed, 2);
    } finally {
      paperlessService.getDocumentMetadata = originalGetDocumentMetadata;
      paperlessService.downloadDocument = originalDownloadDocument;
      visualRagClient.pdfRenderer.renderBuffer = originalRenderBuffer;
      visualRagClient.visualOverlayRepository.deleteByDocId = originalDeleteByDocId;
      visualRagClient.visualOverlayRepository.hasOverlays = originalHasOverlays;
      visualRagClient.ingestionManager.ingestDocument = originalIngestDocument;
    }
  });

  it('returns 400 for invalid document ids', async function () {
    const layer = visualRagRouter.stack.find(
      (item) =>
        item.route &&
        item.route.path === '/reingest/:docId' &&
        item.route.methods.post
    );
    assert.ok(layer, 'expected /reingest/:docId route');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    let statusCode = 200;
    let responseBody = null;
    const req = { params: { docId: 'abc' }, body: {} };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        responseBody = payload;
        return this;
      },
    };

    await handler(req, res);
    assert.strictEqual(statusCode, 400);
    assert.strictEqual(responseBody.success, false);
    assert.strictEqual(responseBody.error, 'Invalid document ID');
  });
});
