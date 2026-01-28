const assert = require('assert');
const chatRouter = require('../../routes/chat.js');

describe('Chat route - model validation integration', function () {
  it('returns 400 when model query param is invalid (query variant)', async function () {
    // Find handler
    const layer = chatRouter.stack.find((l) => l.route && l.route.path === '/chat/init' && l.route.methods.get);
    assert.ok(layer, 'Could not find /chat/init GET layer in router stack');
    const handler = layer.route.stack.find(s => s.method === 'get').handle;

    // Stub ModelResolutionService.validateModel to return false
    const ModelResolutionService = require('../../services/ModelResolutionService');
    const origValidate = ModelResolutionService.validateModel;
    ModelResolutionService.validateModel = async () => false;

    // Stub ChatService to ensure it's not called
    const ChatService = require('../../services/chatService');
    const origInitialize = ChatService.initializeChat;
    let initCalled = false;
    ChatService.initializeChat = async () => { initCalled = true; return {}; };

    const req = { query: { documentId: '42', model: 'nonexistent-model' } };
    let result = null;
    const res = {
      status(code) { this._status = code; return this; },
      json(payload) { result = { status: this._status || 200, payload }; }
    };

    try {
      await handler(req, res);
      assert.ok(result, 'Handler did not call res.json');
      assert.strictEqual(result.status, 400);
      assert.ok(result.payload && result.payload.error && /not available/.test(result.payload.error));
      assert.strictEqual(initCalled, false, 'ChatService.initializeChat should not be called for invalid model');
    } finally {
      ModelResolutionService.validateModel = origValidate;
      ChatService.initializeChat = origInitialize;
    }
  });

  it('accepts a valid model and forwards it to ChatService (path variant)', async function () {
    const layer = chatRouter.stack.find((l) => l.route && l.route.path === '/chat/init/:documentId' && l.route.methods.get);
    assert.ok(layer, 'Could not find /chat/init/:documentId GET layer in router stack');
    const handler = layer.route.stack.find(s => s.method === 'get').handle;

    const ModelResolutionService = require('../../services/ModelResolutionService');
    const origValidate = ModelResolutionService.validateModel;
    ModelResolutionService.validateModel = async () => true;

    const ChatService = require('../../services/chatService');
    const origInitialize = ChatService.initializeChat;
    let receivedOptions = null;
    ChatService.initializeChat = async (documentId, options) => {
      receivedOptions = { documentId, options };
      return { documentTitle: 'Doc 42', initialized: true, history: [], textRagStatus: { available: true, circuitBreakerState: 'CLOSED' } };
    };

    const req = { params: { documentId: '42' }, query: { model: 'valid-model' } };
    let result = null;
    const res = {
      status(code) { this._status = code; return this; },
      json(payload) { result = { status: this._status || 200, payload }; }
    };

    try {
      await handler(req, res);
      assert.ok(result, 'Handler did not call res.json');
      assert.strictEqual(result.status, 200);
      assert.ok(result.payload && result.payload.initialized === true);
      assert.ok(receivedOptions, 'ChatService.initializeChat was not called');
      assert.strictEqual(receivedOptions.documentId, '42');
      assert.strictEqual(receivedOptions.options.model, 'valid-model');

      // Ensure textRagStatus is passed through
      assert.ok(result.payload.textRagStatus && typeof result.payload.textRagStatus.available === 'boolean');
    } finally {
      ModelResolutionService.validateModel = origValidate;
      ChatService.initializeChat = origInitialize;
    }
  });
});