const _tsNodeService = require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});
const assert = require('assert');
const path = require('path');
const { SettingsPageVmSchema } = require('../../src/ui/contracts/Settings.contract.ts');
const settingsRouter = require('../../routes/api/settings.js');
const ModelResolutionService = require('../../services/ModelResolutionService');

describe('Settings route', function() {
  it('renders view using a `vm` object that conforms to the Settings contract', async function() {
    // Find the GET /settings handler from the router stack
    const layer = settingsRouter.stack.find((l) => l.route && l.route.path === '/settings' && l.route.methods.get);
    assert.ok(layer, 'Could not find /settings GET layer in router stack');
    const handler = layer.route.stack.find(s => s.method === 'get').handle;

    // Monkeypatch setupService to prevent external IO and control behavior
    const setupService = require('../../services/setupService.js');
    const originalIsConfigured = setupService.isConfigured;
    const originalLoadConfig = setupService.loadConfig;
    setupService.isConfigured = async () => false;
    setupService.loadConfig = async () => ({});

    // Stub ModelResolutionService so vm contains deterministic model data
    const origGetAll = ModelResolutionService.getAllModels;
    const origGetExpert = ModelResolutionService.getExpertModels;
    ModelResolutionService.getAllModels = async () => ({ ollama: ['sauerkraut-llama3.1:8b'], openai: ['gpt-4'] });
    ModelResolutionService.getExpertModels = () => [{ category: 'financial', role: 'analysis', model: 'fino1-8b' }];

    // Mock req/res
    const req = {};
    let rendered = null;
    const res = {
      render(view, locals) {
        rendered = { view, locals };
      }
    };

    try {
      await handler(req, res);
      assert.ok(rendered, 'Handler did not call res.render');
      assert.strictEqual(rendered.view, 'settings');
      assert.ok(rendered.locals && rendered.locals.vm, 'res.render should be called with { vm }');
      // Validate contract parse
      SettingsPageVmSchema.parse(rendered.locals.vm);

      // Should include availableModels and expertModels on vm
      assert.ok(rendered.locals.vm.availableModels && rendered.locals.vm.availableModels.ollama, 'availableModels.ollama missing');
      assert.ok(Array.isArray(rendered.locals.vm.expertModels), 'expertModels should be an array');
    } finally {
      // Restore
      setupService.isConfigured = originalIsConfigured;
      setupService.loadConfig = originalLoadConfig;
      ModelResolutionService.getAllModels = origGetAll;
      ModelResolutionService.getExpertModels = origGetExpert;
    }
  });

  it('template guardrails: uses vm-only, has data-page, and exposes expected data-testids', async function() {
    const fs = require('fs');
    const ejs = require('ejs');
    const templatePath = path.join(__dirname, '../../views/settings.ejs');
    const templateSource = fs.readFileSync(templatePath, 'utf8');

    // Guardrail: template must not contain direct `config.` usage
    assert.strictEqual(templateSource.includes('config.'), false, 'Template should not reference `config.` directly; use `vm.*`');

    // Invoke the route handler to get a real vm (same pattern as the main test)
    const layer = settingsRouter.stack.find((l) => l.route && l.route.path === '/settings' && l.route.methods.get);
    assert.ok(layer, 'Could not find /settings GET layer in router stack');
    const handler = layer.route.stack.find(s => s.method === 'get').handle;

    // Monkeypatch setupService to prevent external IO and control behavior
    const setupService = require('../../services/setupService.js');
    const originalIsConfigured = setupService.isConfigured;
    const originalLoadConfig = setupService.loadConfig;
    setupService.isConfigured = async () => false;
    setupService.loadConfig = async () => ({});

    // Stub ModelResolutionService
    const origGetAll = ModelResolutionService.getAllModels;
    const origGetExpert = ModelResolutionService.getExpertModels;
    ModelResolutionService.getAllModels = async () => ({ ollama: ['sauerkraut-llama3.1:8b'], openai: ['gpt-4'] });
    ModelResolutionService.getExpertModels = () => [{ category: 'financial', role: 'analysis', model: 'fino1-8b' }];

    // Mock req/res
    const req = {};
    let rendered = null;
    const res = {
      render(view, locals) {
        rendered = { view, locals };
      }
    };

    try {
      await handler(req, res);
      assert.ok(rendered, 'Handler did not call res.render');

      // Render with the vm captured by the handler
      const html = ejs.render(templateSource, { vm: rendered.locals.vm }, { filename: templatePath });

      // Must contain data-page on body
      assert.ok(/<body[^>]*data-page=/.test(html), 'Rendered HTML should include data-page on body');

      // Must contain specific data-testids
      assert.ok(/data-testid="settings-api-key"/.test(html), 'settings-api-key data-testid missing');
      assert.ok(/data-testid="settings-regenerate-btn"/.test(html), 'settings-regenerate-btn data-testid missing');

      // Restore model stubs
      ModelResolutionService.getAllModels = origGetAll;
      ModelResolutionService.getExpertModels = origGetExpert;
    } finally {
      // Restore
      setupService.isConfigured = originalIsConfigured;
      setupService.loadConfig = originalLoadConfig;
    }
  });

  it('POST /settings validates submitted model against ModelResolutionService and rejects unknown models', async function() {
    // Find POST handler
    const layer = settingsRouter.stack.find((l) => l.route && l.route.path === '/settings' && l.route.methods.post);
    assert.ok(layer, 'Could not find /settings POST layer in router stack');
    // The route stack includes middleware (json parser) then the handler; take the last stack entry
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    // Stub ModelResolutionService.validateModel to return false
    const origValidate = ModelResolutionService.validateModel;
    ModelResolutionService.validateModel = async () => false;

    // Stub setupService to avoid external IO
    const setupService = require('../../services/setupService.js');
    const origValidatePaperless = setupService.validatePaperlessConfig;
    setupService.validatePaperlessConfig = async () => true;
    const origValidateOllama = setupService.validateOllamaConfig;
    setupService.validateOllamaConfig = async () => true;
    const origSaveConfig = setupService.saveConfig;
    setupService.saveConfig = async () => undefined;

    // Prevent process.exit side effects
    const origExit = process.exit;
    process.exit = () => undefined;

    try {
      const req = { body: { aiProvider: 'ollama', ollamaModel: 'nonexistent-model' } };
      let status = 200;
      let jsonBody = null;
      const res = {
        status(s) { status = s; return this; },
        json(obj) { jsonBody = obj; }
      };

      await handler(req, res);
      assert.strictEqual(status, 400, 'POST should reject unknown model with 400');
      assert.ok(jsonBody && jsonBody.error && /model/i.test(jsonBody.error), 'Expected error about model');
    } finally {
      ModelResolutionService.validateModel = origValidate;
      setupService.validatePaperlessConfig = origValidatePaperless;
      setupService.validateOllamaConfig = origValidateOllama;
      setupService.saveConfig = origSaveConfig;
      process.exit = origExit;
    }
  });

  it('POST /settings accepts a valid model and saves configuration', async function() {
    // Find POST handler
    const layer = settingsRouter.stack.find((l) => l.route && l.route.path === '/settings' && l.route.methods.post);
    assert.ok(layer, 'Could not find /settings POST layer in router stack');
    // The route stack includes middleware (json parser) then the handler; take the last stack entry
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    // Also test permissive behavior when provider model list is empty
    const origGetForProvider = ModelResolutionService.getModelsForProvider;
    ModelResolutionService.getModelsForProvider = async () => [];

    // Stub ModelResolutionService.validateModel to return true
    const origValidate = ModelResolutionService.validateModel;
    ModelResolutionService.validateModel = async () => true;

    // Stub setupService to avoid external IO
    const setupService = require('../../services/setupService.js');
    const origValidatePaperless = setupService.validatePaperlessConfig;
    setupService.validatePaperlessConfig = async () => true;
    const origValidateOllama = setupService.validateOllamaConfig;
    setupService.validateOllamaConfig = async () => true;
    let saved = false;
    const origSaveConfig = setupService.saveConfig;
    setupService.saveConfig = async () => { saved = true; };

    // Spy on clearCache
    let cacheCleared = false;
    const origClear = ModelResolutionService.clearCache;
    ModelResolutionService.clearCache = () => { cacheCleared = true; };

    // Prevent process.exit side effects
    const origExit = process.exit;
    process.exit = () => undefined;

    try {
      const req = { body: { aiProvider: 'ollama', ollamaModel: 'sauerkraut-llama3.1:8b' } };
      let status = 200;
      let jsonBody = null;
      const res = {
        status(s) { status = s; return this; },
        json(obj) { jsonBody = obj; }
      };

      await handler(req, res);
      assert.strictEqual(status, 200, 'POST should accept valid model');
      assert.ok(jsonBody && jsonBody.success, 'Expected success response');
      assert.ok(saved, 'Expected saveConfig to be called');
      assert.ok(cacheCleared, 'Expected ModelResolutionService.clearCache to be invoked');
    } finally {
      ModelResolutionService.getModelsForProvider = origGetForProvider;
      ModelResolutionService.validateModel = origValidate;
      ModelResolutionService.clearCache = origClear;
      setupService.validatePaperlessConfig = origValidatePaperless;
      setupService.validateOllamaConfig = origValidateOllama;
      setupService.saveConfig = origSaveConfig;
      process.exit = origExit;
    }
  });

});