/* eslint-env mocha */
const assert = require('assert');

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
      async stream() {
        return (async function* streamChunks() {
          yield { text: 'Hello' };
          yield { text: ' world' };
          yield { event: 'expert_thinking', text: 'Thinking...' };
        })();
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

  it('should stream tokens and metadata via SSE', async function() {
    // Find the POST /test/stream handler.
    const layer = promptsRouter.stack.find(
      (l) => l.route &&
        l.route.path === '/:id/test/stream' &&
        l.route.methods.post
    );
    assert.ok(layer, 'Could not find /:id/test/stream POST layer');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    const req = {
      params: { id: 'SYS_ROUTER_V1' },
      body: { variables: {} },
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

    // Verify metadata.
    assert.ok(
      eventStrings.some((s) => s.includes('event: metadata')),
      'Missing metadata event'
    );

    // Verify tokens.
    assert.ok(
      eventStrings.some((s) =>
        s.includes('event: token') && s.includes('Hello')
      ),
      'Missing first token'
    );
    assert.ok(
      eventStrings.some((s) =>
        s.includes('event: token') && s.includes(' world')
      ),
      'Missing second token'
    );

    // Verify thinking.
    assert.ok(
      eventStrings.some((s) =>
        s.includes('event: thinking') && s.includes('Thinking...')
      ),
      'Missing thinking event'
    );

    // Verify done.
    assert.ok(
      eventStrings.some((s) => s.includes('event: done')),
      'Missing done event'
    );
  });
});
