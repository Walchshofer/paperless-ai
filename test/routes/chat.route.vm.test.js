require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS' } });
const assert = require('assert');
const _path = require('path');
const _ejs = require('ejs');
const chatRouter = require('../../routes/chat.js');
const { ChatWorkspaceSchema } = require('../../src/ui/contracts/ChatWorkspace.contract.ts');

describe('Chat route VM', function () {
  it('provides modelConfig and textRagStatus in vm.chat when rendering /chat', async function () {
    // Find handler
    const layer = chatRouter.stack.find((l) => l.route && l.route.path === '/chat' && l.route.methods.get);
    assert.ok(layer, 'Could not find /chat GET layer in router stack');
    const handler = layer.route.stack.find(s => s.method === 'get').handle;

    // Stub services
    const ModelResolutionService = require('../../services/ModelResolutionService');
    const origGetAll = ModelResolutionService.getAllModels;
    const origGetExpert = ModelResolutionService.getExpertModels;
    ModelResolutionService.getAllModels = async () => ({ ollama: ['m1'], openai: ['gpt-4'] });
    ModelResolutionService.getExpertModels = () => [{ model: 'fino1-8b', label: 'Financial' }];

    const chatService = require('../../services/chatService.js');
    const origTextRag = chatService.getTextRagStatus;
    chatService.getTextRagStatus = () => ({ available: false, circuitBreakerState: 'OPEN' });

    // Stub paperlessService.getAllDocumentsUnfiltered to avoid external IO
    const paperlessService = require('../../services/paperlessService.js');
    const origGetDocs = paperlessService.getAllDocumentsUnfiltered;
    paperlessService.getAllDocumentsUnfiltered = async () => [{ id: 1, title: 'Doc 1' }];

    // Prepare req/res
    const req = { query: {} };
    let rendered = null;
    const res = {
      render(view, locals) { rendered = { view, locals }; }
    };

    try {
      await handler(req, res);
      assert.ok(rendered, 'Handler did not call res.render');
      assert.strictEqual(rendered.view, 'chat');
      assert.ok(rendered.locals && rendered.locals.vm && rendered.locals.vm.chat, 'vm.chat missing');

      // Validate presence and shape
      const chatVm = rendered.locals.vm.chat;
      assert.ok(chatVm.modelConfig && chatVm.modelConfig.providers, 'modelConfig.providers missing');
      assert.ok(chatVm.textRagStatus && typeof chatVm.textRagStatus.available === 'boolean', 'textRagStatus missing or invalid');

      // Validate contract (ChatWorkspaceSchema expects modelConfig and textRagStatus optional fields)
      ChatWorkspaceSchema.parse(chatVm);
    } finally {
      ModelResolutionService.getAllModels = origGetAll;
      ModelResolutionService.getExpertModels = origGetExpert;
      chatService.getTextRagStatus = origTextRag;
      paperlessService.getAllDocumentsUnfiltered = origGetDocs;
    }
  });
});