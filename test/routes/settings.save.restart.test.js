/* eslint-env mocha */
const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');

const settingsRouter = require('../../routes/api/settings.js');

const ENV_FILE_PATH = path.join(__dirname, '../../data/runtime.env');

function getSaveHandler() {
  const layer = settingsRouter.stack.find(
    (item) => item.route
      && item.route.path === '/save'
      && item.route.methods
      && item.route.methods.post
  );

  assert.ok(layer, 'Could not find /save POST route in settings router');
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe('Settings API /save restart behavior', function() {
  let originalEnvExists = false;
  let originalEnvContent = '';

  beforeEach(async function() {
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
      'TOKEN_LIMIT=128000\nRESPONSE_TOKENS=4096\n',
      'utf8'
    );
  });

  afterEach(async function() {
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

  it('does not auto-restart by default when restart is required', async function() {
    const saveHandler = getSaveHandler();
    const originalExit = process.exit;
    const originalFlag = process.env.SETTINGS_AUTO_RESTART_ENABLED;

    let exited = false;
    process.exit = () => {
      exited = true;
    };
    delete process.env.SETTINGS_AUTO_RESTART_ENABLED;

    let statusCode = 200;
    let jsonPayload = null;
    const req = { body: { TOKEN_LIMIT: '256000' } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        jsonPayload = payload;
      }
    };

    try {
      await saveHandler(req, res);
      await new Promise((resolve) => setTimeout(resolve, 1200));

      assert.strictEqual(statusCode, 200);
      assert.ok(jsonPayload && jsonPayload.success);
      assert.strictEqual(jsonPayload.restartRequired, true);
      assert.match(
        jsonPayload.message,
        /Restart required to apply changes/i
      );
      assert.strictEqual(exited, false);

      const updated = await fs.readFile(ENV_FILE_PATH, 'utf8');
      assert.match(updated, /TOKEN_LIMIT=256000/);
    } finally {
      process.exit = originalExit;
      if (originalFlag === undefined) {
        delete process.env.SETTINGS_AUTO_RESTART_ENABLED;
      } else {
        process.env.SETTINGS_AUTO_RESTART_ENABLED = originalFlag;
      }
    }
  });

  it('auto-restarts only when SETTINGS_AUTO_RESTART_ENABLED is true', async function() {
    const saveHandler = getSaveHandler();
    const originalExit = process.exit;
    const originalFlag = process.env.SETTINGS_AUTO_RESTART_ENABLED;

    let exited = false;
    process.exit = () => {
      exited = true;
    };
    process.env.SETTINGS_AUTO_RESTART_ENABLED = 'yes';

    let statusCode = 200;
    let jsonPayload = null;
    const req = { body: { TOKEN_LIMIT: '300000' } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        jsonPayload = payload;
      }
    };

    try {
      await saveHandler(req, res);
      await new Promise((resolve) => setTimeout(resolve, 1200));

      assert.strictEqual(statusCode, 200);
      assert.ok(jsonPayload && jsonPayload.success);
      assert.strictEqual(jsonPayload.restartRequired, true);
      assert.match(jsonPayload.message, /Restart scheduled/i);
      assert.strictEqual(exited, true);
    } finally {
      process.exit = originalExit;
      if (originalFlag === undefined) {
        delete process.env.SETTINGS_AUTO_RESTART_ENABLED;
      } else {
        process.env.SETTINGS_AUTO_RESTART_ENABLED = originalFlag;
      }
    }
  });
});
