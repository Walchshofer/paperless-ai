/* eslint-env mocha */
const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');

const settingsRouter = require('../../routes/api/settings.js');

const ENV_FILE_PATH = path.join(__dirname, '../../data/runtime.env');

function getPresetApplyHandler() {
  const layer = settingsRouter.stack.find(
    (item) => item.route
      && item.route.path === '/presets/:name'
      && item.route.methods
      && item.route.methods.post
  );

  assert.ok(layer, 'Could not find /presets/:name POST route in settings router');
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe('Settings API /presets/:name visual-enrichment policy', function () {
  let originalEnvExists = false;
  let originalEnvContent = '';

  beforeEach(async function () {
    try {
      originalEnvContent = await fs.readFile(ENV_FILE_PATH, 'utf8');
      originalEnvExists = true;
    } catch (_error) {
      originalEnvExists = false;
      originalEnvContent = '';
    }

    await fs.mkdir(path.dirname(ENV_FILE_PATH), { recursive: true });
    await fs.writeFile(
      ENV_FILE_PATH,
      [
        'ENABLE_VISUAL_RAG=no',
        'ENABLE_VISUAL_RAG_SIDECAR=no',
        'FORCE_VISUAL_RAG=yes',
        ''
      ].join('\n'),
      'utf8'
    );
  });

  afterEach(async function () {
    if (originalEnvExists) {
      await fs.writeFile(ENV_FILE_PATH, originalEnvContent, 'utf8');
      return;
    }

    try {
      await fs.unlink(ENV_FILE_PATH);
    } catch (_error) {
      // no-op
    }
  });

  it('preview for production preset enforces visual-first keys at route level', async function () {
    const handler = getPresetApplyHandler();

    const req = {
      params: { name: 'production' },
      body: { preview: true }
    };

    let statusCode = 200;
    let jsonPayload = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        jsonPayload = payload;
      }
    };

    await handler(req, res);

    assert.strictEqual(statusCode, 200);
    assert.ok(jsonPayload && jsonPayload.success);
    assert.ok(jsonPayload.diff && Array.isArray(jsonPayload.diff.changes));

    const changeByKey = new Map(
      jsonPayload.diff.changes.map((entry) => [entry.key, entry])
    );

    assert.strictEqual(
      changeByKey.get('ENABLE_VISUAL_RAG')?.newValue,
      'yes',
      'production preset preview must promote ENABLE_VISUAL_RAG=yes'
    );
    assert.strictEqual(
      changeByKey.get('ENABLE_VISUAL_RAG_SIDECAR')?.newValue,
      'yes',
      'production preset preview must promote ENABLE_VISUAL_RAG_SIDECAR=yes'
    );
    assert.strictEqual(
      changeByKey.get('FORCE_VISUAL_RAG')?.newValue,
      'no',
      'production preset must preserve explicit fallback-safe FORCE_VISUAL_RAG=no'
    );
  });

  it('apply production preset writes visual-first policy values', async function () {
    const handler = getPresetApplyHandler();

    const req = {
      params: { name: 'production' },
      body: { preview: false }
    };

    let statusCode = 200;
    let jsonPayload = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        jsonPayload = payload;
      }
    };

    await handler(req, res);

    assert.strictEqual(statusCode, 200);
    assert.ok(jsonPayload && jsonPayload.success);

    const updated = await fs.readFile(ENV_FILE_PATH, 'utf8');
    assert.match(updated, /ENABLE_VISUAL_RAG=yes/);
    assert.match(updated, /ENABLE_VISUAL_RAG_SIDECAR=yes/);
    assert.match(updated, /FORCE_VISUAL_RAG=no/);
  });
});
