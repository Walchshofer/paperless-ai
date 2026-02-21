/* eslint-env mocha */

const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;

describe('Prompts API - SSE Streaming', function() {
  let promptsRouter;

  beforeEach(function() {
    delete require.cache[require.resolve('../../routes/api/prompts')];
    delete require.cache[
      require.resolve('../../services/guidance/GuidanceClient')
    ];

    // Mock auth middleware before loading router.
    const authMock = {
      authenticateApi: (req, _res, next) => {
        req.user = { id: 1, username: 'admin', role: 'admin' };
        next();
      },
      requireAdmin: (_req, _res, next) => { next(); },
    };
    require.cache[require.resolve('../../middleware/auth')] = {
      exports: authMock,
    };

    // Mock GuidanceClient used by module-local getGuidanceClient().
    class GuidanceClientMock {
      async isAvailable() {
        return true;
      }

      async generate(_template, _vars, options = {}) {
        if (typeof options.onProgress === 'function') {
          options.onProgress({ stage: 'token', content: 'Hello' });
          options.onProgress({ stage: 'token', content: ' world' });
          options.onProgress({ stage: 'thinking', content: 'Thinking...' });
        }
        return { generated: 'Hello world' };
      }
    }
    require.cache[require.resolve('../../services/guidance/GuidanceClient')] = {
      exports: {
        GuidanceClient: GuidanceClientMock,
      },
    };

    promptsRouter = require('../../routes/api/prompts');
  });

  afterEach(function() {
    delete require.cache[require.resolve('../../routes/api/prompts')];
    delete require.cache[
      require.resolve('../../services/guidance/GuidanceClient')
    ];
  });

  it('should stream metadata, tokens, thinking, and done for text prompts', async function() {
    const layer = promptsRouter.stack.find(
      (l) => l.route
        && l.route.path === '/:id/test/stream'
        && l.route.methods.post
    );
    assert.ok(layer, 'Could not find /:id/test/stream POST layer');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    const req = {
      params: { id: 'GEN_FALLBACK_V1' },
      body: {
        variables: {
          text_chunk: 'example text',
          source_system: 'test-lab'
        }
      },
      user: { id: 1, username: 'admin', role: 'admin' },
    };

    const events = [];
    const res = {
      setHeader: () => {},
      write(data) {
        events.push(data);
      },
      end: () => {},
    };

    await handler(req, res);

    const eventStrings = events.join('').split('\n\n');

    assert.ok(
      eventStrings.some((s) => s.includes('event: metadata')),
      'Missing metadata event'
    );
    assert.ok(
      eventStrings.some(
        (s) => s.includes('event: token') && s.includes('Hello')
      ),
      'Missing first token'
    );
    assert.ok(
      eventStrings.some(
        (s) => s.includes('event: token') && s.includes(' world')
      ),
      'Missing second token'
    );
    assert.ok(
      eventStrings.some(
        (s) => s.includes('event: thinking') && s.includes('Thinking...')
      ),
      'Missing thinking event'
    );
    assert.ok(
      eventStrings.some((s) => s.includes('event: done')),
      'Missing done event'
    );
  });

  it('should emit error without done when multimodal vision execution fails', async function() {
    const layer = promptsRouter.stack.find(
      (l) => l.route
        && l.route.path === '/:id/test/stream'
        && l.route.methods.post
    );
    assert.ok(layer, 'Could not find /:id/test/stream POST layer');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    const aiFactory = require('../../services/aiServiceFactory');
    const originalGetService = aiFactory.getService;
    aiFactory.getService = () => ({
      _callOllamaVisionAPI: async () => {
        throw new Error('Request failed with status code 500');
      }
    });

    const tmpImagePath = path.join(
      os.tmpdir(),
      `prompts-sse-${Date.now()}.png`
    );
    const png1x1 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAF+wJ/lq0w5gAAAABJRU5ErkJggg==';
    await fs.writeFile(tmpImagePath, Buffer.from(png1x1, 'base64'));

    const req = {
      params: { id: 'VIS_OCR_V1' },
      body: {
        variables: {
          page_number: '1',
          total_pages: '1',
          __image_path: tmpImagePath
        }
      },
      user: { id: 1, username: 'admin', role: 'admin' },
    };

    const events = [];
    const res = {
      setHeader: () => {},
      write(data) {
        events.push(data);
      },
      end: () => {},
    };

    try {
      await handler(req, res);
    } finally {
      aiFactory.getService = originalGetService;
      await fs.unlink(tmpImagePath).catch(() => {});
    }

    const eventStrings = events.join('').split('\n\n');
    assert.ok(
      eventStrings.some((s) => s.includes('event: error')),
      'Expected error event when multimodal vision call fails'
    );
    assert.strictEqual(
      eventStrings.some((s) => s.includes('event: done')),
      false,
      'Done event must not be emitted after stream error'
    );
  });

  it('should fallback to non-stream vision call when streaming call fails', async function() {
    const layer = promptsRouter.stack.find(
      (l) => l.route
        && l.route.path === '/:id/test/stream'
        && l.route.methods.post
    );
    assert.ok(layer, 'Could not find /:id/test/stream POST layer');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    const aiFactory = require('../../services/aiServiceFactory');
    const originalGetService = aiFactory.getService;
    let callCount = 0;
    aiFactory.getService = () => ({
      _callOllamaVisionAPI: async () => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error('Request failed with status code 500');
        }
        return { response: 'Fallback OCR text' };
      }
    });

    const tmpImagePath = path.join(
      os.tmpdir(),
      `prompts-sse-fallback-${Date.now()}.png`
    );
    const png1x1 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAF+wJ/lq0w5gAAAABJRU5ErkJggg==';
    await fs.writeFile(tmpImagePath, Buffer.from(png1x1, 'base64'));

    const req = {
      params: { id: 'VIS_OCR_V1' },
      body: {
        variables: {
          page_number: '1',
          total_pages: '1',
          __image_path: tmpImagePath
        }
      },
      user: { id: 1, username: 'admin', role: 'admin' },
    };

    const events = [];
    const res = {
      setHeader: () => {},
      write(data) {
        events.push(data);
      },
      end: () => {},
    };

    try {
      await handler(req, res);
    } finally {
      aiFactory.getService = originalGetService;
      await fs.unlink(tmpImagePath).catch(() => {});
    }

    const eventStrings = events.join('').split('\n\n');
    assert.ok(
      eventStrings.some(
        (s) => s.includes('event: token') && s.includes('Fallback OCR text')
      ),
      'Expected fallback token from non-stream vision call'
    );
    assert.ok(
      eventStrings.some((s) => s.includes('event: done')),
      'Expected done event after fallback succeeds'
    );
    assert.strictEqual(
      eventStrings.some((s) => s.includes('event: error')),
      false,
      'Error event must not be emitted when fallback succeeds'
    );
  });
});
