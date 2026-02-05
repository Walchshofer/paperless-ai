const assert = require('assert');
const ragRouter = require('../../routes/rag');
const ragService = require('../../services/ragService');

describe('RAG route - POST /reingest/:documentId', function () {
  it('forces indexing and returns success payload with requested document id', async function () {
    const layer = ragRouter.stack.find(
      (item) =>
        item.route &&
        item.route.path === '/reingest/:documentId' &&
        item.route.methods.post
    );
    assert.ok(layer, 'expected /reingest/:documentId route');

    const handler = layer.route.stack[layer.route.stack.length - 1].handle;
    const originalIndexDocuments = ragService.indexDocuments;
    let calledWith = null;

    ragService.indexDocuments = async (force) => {
      calledWith = force;
      return { started: true };
    };

    let statusCode = 200;
    let responseBody = null;
    const req = { params: { documentId: '42' } };
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
      assert.strictEqual(calledWith, true, 'should force re-indexing');
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(responseBody.success, true);
      assert.strictEqual(responseBody.documentId, 42);
      assert.strictEqual(responseBody.backendScope, 'global');
    } finally {
      ragService.indexDocuments = originalIndexDocuments;
    }
  });

  it('returns 400 for invalid document ids', async function () {
    const layer = ragRouter.stack.find(
      (item) =>
        item.route &&
        item.route.path === '/reingest/:documentId' &&
        item.route.methods.post
    );
    assert.ok(layer, 'expected /reingest/:documentId route');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    let statusCode = 200;
    let responseBody = null;
    const req = { params: { documentId: 'abc' } };
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
    assert.strictEqual(responseBody.error, 'Invalid document ID');
  });
});
