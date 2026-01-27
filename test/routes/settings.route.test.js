const tsNodeService = require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});
const assert = require('assert');
const path = require('path');
const { SettingsPageVmSchema } = require('../../src/ui/contracts/Settings.contract.ts');
const settingsRouter = require('../../routes/settings.js');

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
    } finally {
      // Restore
      setupService.isConfigured = originalIsConfigured;
      setupService.loadConfig = originalLoadConfig;
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
    } finally {
      // Restore
      setupService.isConfigured = originalIsConfigured;
      setupService.loadConfig = originalLoadConfig;
    }
  });

});