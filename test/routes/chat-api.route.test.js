/**
 * @fileoverview Unit tests for Chat API routes (Text RAG, Visual RAG, Document modes).
 * @see tickets/e69971fa-a795-43ef-a75f-4dae52ee65aa
 */
const assert = require('node:assert');
const { describe, it, beforeEach, afterEach } = require('node:test');

describe('Chat API Routes', function () {
  let chatRouter;
  let mockReq;
  let mockRes;
  let originalRagService;
  let originalAIServiceFactory;

  beforeEach(function () {
    // Reset module cache to ensure fresh imports
    delete require.cache[require.resolve('../../routes/api/chat.js')];
    
    // Mock response object
    mockRes = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.jsonData = data;
        return this;
      },
      statusCode: 200,
      jsonData: null
    };

    // Mock request object
    mockReq = {
      body: {},
      query: {},
      user: { id: 'test-user' }
    };
  });

  afterEach(function () {
    // Restore original modules if mocked
    if (originalRagService) {
      require.cache[require.resolve('../../services/ragService.js')].exports = originalRagService;
    }
    if (originalAIServiceFactory) {
      require.cache[require.resolve('../../services/aiServiceFactory.js')].exports = originalAIServiceFactory;
    }
  });

  describe('POST /api/chat/rag', function () {
    it('should return 400 if message is missing', async function () {
      chatRouter = require('../../routes/api/chat.js');
      
      // Find the RAG route handler
      const ragLayer = chatRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/rag' && layer.route.methods.post
      );
      assert.ok(ragLayer, 'RAG POST route should exist');
      
      // Get the handler (last function in stack, skip auth middleware)
      const handlers = ragLayer.route.stack;
      const handler = handlers[handlers.length - 1].handle;
      
      mockReq.body = { model: 'llama3.2' }; // Missing message
      
      await handler(mockReq, mockRes);
      
      assert.strictEqual(mockRes.statusCode, 400);
      assert.ok(mockRes.jsonData.error.includes('Message is required'));
    });

    it('should return 400 if model is missing', async function () {
      chatRouter = require('../../routes/api/chat.js');
      
      const ragLayer = chatRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/rag' && layer.route.methods.post
      );
      const handlers = ragLayer.route.stack;
      const handler = handlers[handlers.length - 1].handle;
      
      mockReq.body = { message: 'test query' }; // Missing model
      
      await handler(mockReq, mockRes);
      
      assert.strictEqual(mockRes.statusCode, 400);
      assert.ok(mockRes.jsonData.error.includes('Model is required'));
    });
  });

  describe('POST /api/chat/document', function () {
    it('should return 400 if documentId is missing', async function () {
      chatRouter = require('../../routes/api/chat.js');
      
      const docLayer = chatRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/document' && layer.route.methods.post
      );
      assert.ok(docLayer, 'Document POST route should exist');
      
      const handlers = docLayer.route.stack;
      const handler = handlers[handlers.length - 1].handle;
      
      mockReq.body = { message: 'test question', model: 'llama3.2' }; // Missing documentId
      
      await handler(mockReq, mockRes);
      
      assert.strictEqual(mockRes.statusCode, 400);
      assert.ok(mockRes.jsonData.error.includes('Document ID is required'));
    });

    it('should return 400 if message is missing', async function () {
      chatRouter = require('../../routes/api/chat.js');
      
      const docLayer = chatRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/document' && layer.route.methods.post
      );
      const handlers = docLayer.route.stack;
      const handler = handlers[handlers.length - 1].handle;
      
      mockReq.body = { documentId: 123, model: 'llama3.2' }; // Missing message
      
      await handler(mockReq, mockRes);
      
      assert.strictEqual(mockRes.statusCode, 400);
      assert.ok(mockRes.jsonData.error.includes('Message is required'));
    });
  });

  describe('POST /api/chat/visual-rag', function () {
    it('should return 400 if message is missing', async function () {
      chatRouter = require('../../routes/api/chat.js');
      
      const visualRagLayer = chatRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/visual-rag' && layer.route.methods.post
      );
      assert.ok(visualRagLayer, 'Visual RAG POST route should exist');
      
      const handlers = visualRagLayer.route.stack;
      const handler = handlers[handlers.length - 1].handle;
      
      mockReq.body = { model: 'llama3.2' }; // Missing message
      
      await handler(mockReq, mockRes);
      
      assert.strictEqual(mockRes.statusCode, 400);
      assert.ok(mockRes.jsonData.error.includes('Message is required'));
    });

    it('should return 400 if model is missing', async function () {
      chatRouter = require('../../routes/api/chat.js');
      
      const visualRagLayer = chatRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/visual-rag' && layer.route.methods.post
      );
      const handlers = visualRagLayer.route.stack;
      const handler = handlers[handlers.length - 1].handle;
      
      mockReq.body = { message: 'Find documents with tables' }; // Missing model
      
      await handler(mockReq, mockRes);
      
      assert.strictEqual(mockRes.statusCode, 400);
      assert.ok(mockRes.jsonData.error.includes('Model is required'));
    });
  });

  describe('GET /api/chat/status', function () {
    it('should have status endpoint', function () {
      chatRouter = require('../../routes/api/chat.js');
      
      const statusLayer = chatRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/status' && layer.route.methods.get
      );
      assert.ok(statusLayer, 'Status GET route should exist');
    });
  });

  describe('Route structure', function () {
    it('should export an Express router', function () {
      chatRouter = require('../../routes/api/chat.js');
      
      assert.ok(chatRouter, 'Router should be exported');
      assert.ok(chatRouter.stack, 'Router should have a stack');
      assert.ok(Array.isArray(chatRouter.stack), 'Stack should be an array');
    });

    it('should have all required routes', function () {
      chatRouter = require('../../routes/api/chat.js');
      
      const routes = chatRouter.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods).filter(m => layer.route.methods[m])
        }));
      
      // Check for RAG route
      const ragRoute = routes.find(r => r.path === '/rag');
      assert.ok(ragRoute, 'RAG route should exist');
      assert.ok(ragRoute.methods.includes('post'), 'RAG route should support POST');
      
      // Check for Visual RAG route
      const visualRagRoute = routes.find(r => r.path === '/visual-rag');
      assert.ok(visualRagRoute, 'Visual RAG route should exist');
      assert.ok(visualRagRoute.methods.includes('post'), 'Visual RAG route should support POST');
      
      // Check for Document route
      const docRoute = routes.find(r => r.path === '/document');
      assert.ok(docRoute, 'Document route should exist');
      assert.ok(docRoute.methods.includes('post'), 'Document route should support POST');
      
      // Check for Status route
      const statusRoute = routes.find(r => r.path === '/status');
      assert.ok(statusRoute, 'Status route should exist');
      assert.ok(statusRoute.methods.includes('get'), 'Status route should support GET');
    });
  });

  describe('Visual RAG thumbnail URL', function () {
    it('should include thumbnailUrl in sources for valid document IDs', function () {
      // Verify the source formatting logic includes thumbnails
      const docId = 123;
      const source = {
        doc_id: docId,
        title: 'Test Document',
        page: 1,
        score: 0.85,
        visualScore: 0.9,
        textScore: 0.8
      };
      
      // Simulate the source mapping logic from the route
      const formattedSource = {
        documentId: source.doc_id || source.documentId,
        title: source.title || `Document #${source.doc_id || source.documentId}`,
        page: source.page || 1,
        confidence: source.score || source.confidence || 0.5,
        visualScore: source.visualScore,
        textScore: source.textScore,
        thumbnailUrl: source.doc_id ? `/documents/${source.doc_id}/thumbnail` : undefined
      };
      
      assert.strictEqual(formattedSource.documentId, 123);
      assert.strictEqual(formattedSource.thumbnailUrl, '/documents/123/thumbnail');
    });

    it('should not include thumbnailUrl for sources without document ID', function () {
      const source = {
        title: 'Unknown',
        page: 1,
        score: 0.5
      };
      
      const docId = source.doc_id || source.documentId;
      const formattedSource = {
        documentId: docId,
        title: source.title,
        page: source.page || 1,
        confidence: source.score || 0.5,
        thumbnailUrl: docId ? `/documents/${docId}/thumbnail` : undefined
      };
      
      assert.strictEqual(formattedSource.thumbnailUrl, undefined);
    });
  });});