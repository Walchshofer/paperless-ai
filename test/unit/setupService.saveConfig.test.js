const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const SetupService = require('../../services/setupService');
const proxyConfig = require('../../config/config');

describe('SetupService.saveConfig', () => {
  let svc;
  let tmpDir;
  let originalEnv;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `paperless-test-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    svc = require('../../services/setupService');
    // override runtime path to a temp file
    svc.envPath = path.join(tmpDir, 'runtime.env');

    // snapshot process.env keys we may modify
    originalEnv = Object.assign({}, process.env);
  });

  afterEach(async () => {
    // restore process.env
    Object.keys(process.env).forEach(k => delete process.env[k]);
    Object.assign(process.env, originalEnv);
    // clean up tmp
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  });

  it('writes env file and updates process.env for a plain config object', async () => {
    // stub external validators to avoid network calls in unit tests
    svc.validatePaperlessConfig = async () => true;
    svc.validateApiPermissions = async () => ({ success: true });
    svc.validateOpenAIConfig = async () => true;
    svc.validateOllamaConfig = async () => true;
    svc.validateAzureConfig = async () => true;

    const cfg = { A: '1', B: 'two', SYSTEM_PROMPT: 'line1\nline2', PROMPT_TAGS: ['x','y'], PAPERLESS_API_URL: 'http://localhost:8000/api', PAPERLESS_API_TOKEN: 'tok' };
    await svc.saveConfig(cfg);

    const content = await fs.readFile(svc.envPath, 'utf8');
    assert.ok(content.includes('A=1'), 'env file should contain A=1');
    assert.ok(content.includes('B=two'), 'env file should contain B=two');
    assert.ok(content.includes('SYSTEM_PROMPT='), 'env file should include SYSTEM_PROMPT');
    assert.strictEqual(process.env.A, '1');
    assert.strictEqual(process.env.B, 'two');
  });

  it('accepts proxied config (module.exports) and writes values based on underlying raw config', async () => {
    // stub external validators to avoid network calls in unit tests
    svc.validatePaperlessConfig = async () => true;
    svc.validateApiPermissions = async () => ({ success: true });
    svc.validateOpenAIConfig = async () => true;
    svc.validateOllamaConfig = async () => true;
    svc.validateAzureConfig = async () => true;

    // proxyConfig is the exported config module (proxied); ensure calling saveConfig with it succeeds
    await svc.saveConfig(proxyConfig);
    const content = await fs.readFile(svc.envPath, 'utf8');
    // expect modelAliases to be present as key (toString of object may be [object Object])
    assert.ok(content.includes('modelAliases'), 'env file should contain modelAliases key when saving proxied config');
  });
});
