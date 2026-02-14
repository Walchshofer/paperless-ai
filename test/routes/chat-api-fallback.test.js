/* eslint-env mocha */
const assert = require('assert');
const request = require('supertest');
const { createScopedRouteApp } = require('../helpers/scoped-route-auth');

const CHAT_ROUTE_PATH = require.resolve('../../routes/api/chat');
const TEST_USER = { id: 1, username: 'test', role: 'user' };

function injectMock(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports
  };
}

function buildChatApp(user = TEST_USER) {
  return createScopedRouteApp({
    routePath: CHAT_ROUTE_PATH,
    mountPath: '/api/chat',
    user
  });
}

describe('Chat API fallback', function () {
  let app;

  before(function () {
    injectMock('../../services/aiServiceFactory', {
      getService: () => ({
        chat: async () => {
          throw new Error('chat failed');
        },
        generateText: async () => 'fallback ok'
      })
    });

    injectMock('../../services/paperlessService', {
      getDocument: async (id) => ({ id, title: 'Doc X' }),
      getDocumentContent: async () => 'Document content'
    });

    app = buildChatApp();
  });

  it('uses generateText when generateCompletion is missing', async function () {
    const res = await request(app)
      .post('/api/chat/document')
      .send({
        message: 'What is this?',
        model: 'gpt-oss:latest',
        documentId: 123
      })
      .expect(200);

    assert.strictEqual(res.body.response, 'fallback ok');
  });

  it('falls back gracefully when text-rag service is not ready', async function () {
    injectMock('../../services/aiServiceFactory', {
      getService: () => ({
        chat: async () => ({ content: 'fallback without rag' })
      })
    });

    injectMock('../../services/ragService', {
      checkStatus: async () => ({
        server_up: false,
        index_ready: false,
        data_loaded: false,
        error: 'Service not ready'
      }),
      search: async () => {
        throw new Error('search should not be called when rag is unavailable');
      }
    });

    app = buildChatApp();

    const res = await request(app)
      .post('/api/chat/rag')
      .send({
        message: 'Find sick leave policy',
        model: 'qwen3-vl:8b'
      })
      .expect(200);

    assert.strictEqual(res.body.response, 'fallback without rag');
    assert.strictEqual(res.body.mode, 'text-fallback');
    assert.ok(Array.isArray(res.body.sources), 'sources should be an array');
    assert.strictEqual(res.body.sources.length, 0);
  });

  it('treats qdrant-backed corpus as available even before flags settle', async function () {
    let searchCalled = false;
    injectMock('../../services/aiServiceFactory', {
      getService: () => ({
        chat: async () => ({ content: 'rag path active' })
      })
    });

    injectMock('../../services/ragService', {
      checkStatus: async () => ({
        server_up: true,
        index_ready: false,
        data_loaded: false,
        qdrant_ready: true,
        indexing_status: {
          documents_count: 98
        }
      }),
      search: async () => {
        searchCalled = true;
        return { results: [] };
      }
    });

    app = buildChatApp();

    const res = await request(app)
      .post('/api/chat/rag')
      .send({
        message: 'Find sick leave policy',
        model: 'qwen3-vl:8b'
      })
      .expect(200);

    assert.strictEqual(searchCalled, true);
    assert.strictEqual(res.body.mode, 'rag');
    assert.strictEqual(res.body.response, 'rag path active');
  });

  it('reports rag available in /status for qdrant-backed corpus', async function () {
    injectMock('../../services/ragService', {
      checkStatus: async () => ({
        server_up: true,
        index_ready: false,
        data_loaded: false,
        qdrant_ready: true,
        indexing_status: {
          documents_count: 98
        }
      })
    });
    injectMock('../../services/visual-rag-client/HybridSearchService', {
      getHybridSearchService: () => ({
        isAvailable: async () => ({
          hybrid: false,
          visual: false,
          text: true
        })
      })
    });

    app = buildChatApp();

    const res = await request(app)
      .get('/api/chat/status')
      .expect(200);

    assert.strictEqual(res.body.rag.available, true);
    assert.strictEqual(res.body.rag.qdrantReady, true);
    assert.strictEqual(res.body.rag.documentsCount, 98);
  });

  it('returns 503 when upstream model is unavailable', async function () {
    injectMock('../../services/aiServiceFactory', {
      getService: () => ({
        chat: async () => {
          const err = new Error('Request failed with status code 404');
          err.response = { status: 404, data: { error: "model 'x' not found" } };
          throw err;
        },
        generateText: async () => {
          const err = new Error('Request failed with status code 404');
          err.response = { status: 404, data: { error: "model 'x' not found" } };
          throw err;
        }
      })
    });

    injectMock('../../services/paperlessService', {
      getDocument: async (id) => ({ id, title: 'Doc X' }),
      getDocumentContent: async () => 'Document content'
    });

    app = buildChatApp();

    const res = await request(app)
      .post('/api/chat/document')
      .send({
        message: 'What is this?',
        model: 'missing-model',
        documentId: 123
      })
      .expect(503);

    assert.strictEqual(res.body.reasonCode, 'model_unavailable');
    assert.strictEqual(res.body.model, 'missing-model');
  });

  it('returns 503 when upstream model is unavailable for rag mode', async function () {
    injectMock('../../services/aiServiceFactory', {
      getService: () => ({
        chat: async () => {
          const err = new Error('Request failed with status code 404');
          err.response = { status: 404, data: { error: "model 'x' not found" } };
          throw err;
        },
        generateText: async () => {
          const err = new Error('Request failed with status code 404');
          err.response = { status: 404, data: { error: "model 'x' not found" } };
          throw err;
        }
      })
    });

    injectMock('../../services/ragService', {
      checkStatus: async () => ({
        server_up: true,
        index_ready: true,
        data_loaded: true
      }),
      search: async () => ({ results: [] })
    });

    app = buildChatApp();

    const res = await request(app)
      .post('/api/chat/rag')
      .send({
        message: 'Find invoices',
        model: 'missing-model'
      })
      .expect(503);

    assert.strictEqual(res.body.reasonCode, 'model_unavailable');
    assert.strictEqual(res.body.model, 'missing-model');
  });

  it('returns 503 when upstream model is unavailable for visual-rag mode', async function () {
    injectMock('../../services/aiServiceFactory', {
      getService: () => ({
        chat: async () => {
          const err = new Error('Request failed with status code 404');
          err.response = { status: 404, data: { error: "model 'x' not found" } };
          throw err;
        },
        generateText: async () => {
          const err = new Error('Request failed with status code 404');
          err.response = { status: 404, data: { error: "model 'x' not found" } };
          throw err;
        }
      })
    });

    injectMock('../../services/visual-rag-client/HybridSearchService', {
      getHybridSearchService: () => ({
        isAvailable: async () => ({
          hybrid: true,
          visual: true,
          text: true
        }),
        search: async () => ({ results: [] })
      })
    });

    app = buildChatApp();

    const res = await request(app)
      .post('/api/chat/visual-rag')
      .send({
        message: 'Find invoices',
        model: 'missing-model'
      })
      .expect(503);

    assert.strictEqual(res.body.reasonCode, 'model_unavailable');
    assert.strictEqual(res.body.model, 'missing-model');
  });

  it('normalizes visual-rag source docId keys and resolves title fallback', async function () {
    injectMock('../../services/aiServiceFactory', {
      getService: () => ({
        chat: async () => ({ content: 'visual answer' })
      })
    });

    injectMock('../../services/visual-rag-client/HybridSearchService', {
      getHybridSearchService: () => ({
        isAvailable: async () => ({
          hybrid: true,
          visual: true,
          text: true
        }),
        search: async () => ({
          results: [
            {
              docId: 12,
              pageNum: 1,
              score: 0.11,
              visualScore: 0.12,
              textScore: 0.0
            }
          ]
        })
      })
    });

    injectMock('../../services/paperlessService', {
      getDocument: async (id) => ({ id, title: `Doc ${id}` }),
      getDocumentContent: async () => 'Document content'
    });

    app = buildChatApp();

    const res = await request(app)
      .post('/api/chat/visual-rag')
      .send({
        message: 'Find sick leave notes',
        model: 'qwen3-vl:8b'
      })
      .expect(200);

    assert.strictEqual(res.body.sources.length, 1);
    assert.strictEqual(res.body.sources[0].documentId, 12);
    assert.strictEqual(res.body.sources[0].title, 'Doc 12');
    assert.strictEqual(res.body.sources[0].page, 1);
  });
});
