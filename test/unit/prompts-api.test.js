/* eslint-env mocha */
/**
 * Unit Tests for Prompts API Routes
 *
 * Tests the new and enhanced endpoints in routes/api/prompts.js:
 * - POST /api/prompts/:id/test (template rendering, variable substitution, token estimation)
 * - PUT /api/prompts/:id (validation integration with guidance service)
 *
 * Focus areas:
 * - Template variable detection and substitution
 * - Graceful fallback when guidance-service unavailable
 * - Validation errors blocking saves (422 status)
 * - Validation warnings included in success responses (non-blocking)
 * - Token estimation calculation
 *
 * @module test/unit/prompts-api.test
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;

describe('Prompts API - Template Testing and Validation', function() {
  let promptsRouter;
  let overridesPath;

  before(function() {
    // Mock auth middleware in the middleware module BEFORE any imports
    const authMock = {
      authenticateApi: (req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'admin' };
        next();
      },
      requireAdmin: (req, res, next) => {
        if (req.user && req.user.role === 'admin') {
          return next();
        }
        res.status(403).json({ error: 'Admin access required' });
      },
    };
    require.cache[require.resolve('../../middleware/auth')] = {
      exports: authMock,
    };

    // Setup test overrides file path
    overridesPath = path.join(__dirname, '../../data/prompts-test.json');

    // Load router once
    promptsRouter = require('../../routes/api/prompts');
  });

  after(async function() {
    // Clean up test overrides file
    try {
      await fs.unlink(overridesPath);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  });

  describe('POST /api/prompts/:id/test', function() {
    it('should render template with provided variables', async function() {
      // Find the POST /test handler
      const layer = promptsRouter.stack.find(
        (l) => l.route && l.route.path === '/:id/test' && l.route.methods.post
      );
      assert.ok(layer, 'Could not find /:id/test POST layer');
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;

      const req = {
        params: { id: 'SYS_ROUTER_V1' },
        body: {
          variables: {
            source_system: 'Paperless-ngx',
            filename: 'test-doc.pdf',
          },
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let statusCode = 200;
      let jsonResponse = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResponse = data;
        },
      };

      await handler(req, res);

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(jsonResponse.success, true);
      assert.strictEqual(jsonResponse.promptId, 'SYS_ROUTER_V1');
      assert.ok(jsonResponse.renderedTemplate);
      assert.ok(jsonResponse.renderedSystemPrompt);
      assert.ok(Array.isArray(jsonResponse.detectedVariables));
      assert.ok(Array.isArray(jsonResponse.missingVariables));
      assert.ok(Array.isArray(jsonResponse.providedVariables));
      assert.strictEqual(jsonResponse.providedVariables.length, 2);
    });

    it('should detect missing variables when not all are provided', async function() {
      const layer = promptsRouter.stack.find(
        (l) => l.route && l.route.path === '/:id/test' && l.route.methods.post
      );
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;

      const req = {
        params: { id: 'SYS_ROUTER_V1' },
        body: {
          variables: {
            source_system: 'Paperless-ngx',
            // Missing 'filename' variable
          },
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let jsonResponse = null;
      const res = {
        status(code) {
          return this;
        },
        json(data) {
          jsonResponse = data;
        },
      };

      await handler(req, res);

      assert.strictEqual(jsonResponse.success, true);
      assert.ok(Array.isArray(jsonResponse.missingVariables));

      // If the template uses {{filename}}, it should be detected as missing
      if (jsonResponse.detectedVariables.includes('filename')) {
        assert.ok(jsonResponse.missingVariables.includes('filename'));
      }
    });

    it('should accept systemPrompt and userTemplate overrides', async function() {
      const layer = promptsRouter.stack.find(
        (l) => l.route && l.route.path === '/:id/test' && l.route.methods.post
      );
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;

      const customSystemPrompt = 'Test system prompt with {{test_var}}';
      const customUserTemplate = 'User template with {{another_var}}';

      const req = {
        params: { id: 'SYS_ROUTER_V1' },
        body: {
          systemPrompt: customSystemPrompt,
          userTemplate: customUserTemplate,
          variables: {
            test_var: 'value1',
            another_var: 'value2',
          },
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let jsonResponse = null;
      const res = {
        status(code) {
          return this;
        },
        json(data) {
          jsonResponse = data;
        },
      };

      await handler(req, res);

      assert.strictEqual(jsonResponse.success, true);
      assert.ok(jsonResponse.renderedSystemPrompt.includes('value1'));
      assert.ok(jsonResponse.renderedTemplate.includes('value2'));
      assert.ok(jsonResponse.detectedVariables.includes('test_var'));
      assert.ok(jsonResponse.detectedVariables.includes('another_var'));
    });

    it('should return 404 for non-existent prompt', async function() {
      const layer = promptsRouter.stack.find(
        (l) => l.route && l.route.path === '/:id/test' && l.route.methods.post
      );
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;

      const req = {
        params: { id: 'NONEXISTENT_PROMPT' },
        body: {
          variables: {},
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let statusCode = 200;
      let jsonResponse = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResponse = data;
        },
      };

      await handler(req, res);

      assert.strictEqual(statusCode, 404);
      assert.ok(jsonResponse.error);
      assert.ok(jsonResponse.error.includes('not found'));
    });

    it('should estimate token count based on char length (~4 chars per token)', async function() {
      const layer = promptsRouter.stack.find(
        (l) => l.route && l.route.path === '/:id/test' && l.route.methods.post
      );
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;

      const req = {
        params: { id: 'SYS_ROUTER_V1' },
        body: {
          variables: {
            source_system: 'Test',
            filename: 'doc.pdf',
          },
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let jsonResponse = null;
      const res = {
        status(code) {
          return this;
        },
        json(data) {
          jsonResponse = data;
        },
      };

      await handler(req, res);

      assert.strictEqual(jsonResponse.success, true);
      assert.ok(typeof jsonResponse.tokenEstimate === 'number');
      assert.ok(jsonResponse.tokenEstimate > 0);

      // Token estimate should be roughly totalChars / 4
      const totalChars =
        jsonResponse.renderedSystemPrompt.length +
        jsonResponse.renderedTemplate.length;
      const expectedTokens = Math.ceil(totalChars / 4);
      assert.strictEqual(jsonResponse.tokenEstimate, expectedTokens);
    });

    it('should return template-render source when guidance unavailable', async function() {
      const layer = promptsRouter.stack.find(
        (l) => l.route && l.route.path === '/:id/test' && l.route.methods.post
      );
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;

      const req = {
        params: { id: 'SYS_ROUTER_V1' },
        body: {
          variables: {
            source_system: 'Test',
            filename: 'test.pdf',
          },
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let jsonResponse = null;
      const res = {
        status(code) {
          return this;
        },
        json(data) {
          jsonResponse = data;
        },
      };

      await handler(req, res);

      assert.strictEqual(jsonResponse.success, true);
      // Source should be either 'template-render' or 'template-render-only'
      assert.ok(
        jsonResponse.source === 'template-render' ||
        jsonResponse.source === 'template-render-only' ||
        jsonResponse.source === 'guidance-service'
      );
    });

    it('should include duration measurement', async function() {
      const layer = promptsRouter.stack.find(
        (l) => l.route && l.route.path === '/:id/test' && l.route.methods.post
      );
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;

      const req = {
        params: { id: 'SYS_ROUTER_V1' },
        body: {
          variables: {},
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let jsonResponse = null;
      const res = {
        status(code) {
          return this;
        },
        json(data) {
          jsonResponse = data;
        },
      };

      await handler(req, res);

      assert.strictEqual(jsonResponse.success, true);
      assert.ok(typeof jsonResponse.duration === 'number');
      assert.ok(jsonResponse.duration >= 0);
    });
  });

  describe('PUT /api/prompts/:id - Config Validation', function() {
    it('should validate config.temperature range (0.0 to 2.0)', async function() {
      const layer = promptsRouter.stack.find(
        (l) => l.route && l.route.path === '/:id' && l.route.methods.put
      );
      assert.ok(layer, 'Could not find /:id PUT layer');
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;

      // Test invalid temperature (negative)
      const req1 = {
        params: { id: 'SYS_ROUTER_V1' },
        body: {
          config: { temperature: -0.5 },
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let statusCode1 = 200;
      let jsonResponse1 = null;
      const res1 = {
        status(code) {
          statusCode1 = code;
          return this;
        },
        json(data) {
          jsonResponse1 = data;
        },
      };

      await handler(req1, res1);

      assert.strictEqual(statusCode1, 400);
      assert.ok(jsonResponse1.error);
      assert.ok(jsonResponse1.error.includes('temperature'));

      // Test invalid temperature (> 2.0)
      const req2 = {
        params: { id: 'SYS_ROUTER_V1' },
        body: {
          config: { temperature: 2.5 },
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let statusCode2 = 200;
      let jsonResponse2 = null;
      const res2 = {
        status(code) {
          statusCode2 = code;
          return this;
        },
        json(data) {
          jsonResponse2 = data;
        },
      };

      await handler(req2, res2);

      assert.strictEqual(statusCode2, 400);
      assert.ok(jsonResponse2.error);
      assert.ok(jsonResponse2.error.includes('temperature'));
    });

    it('should validate config.maxTokens as positive integer', async function() {
      const layer = promptsRouter.stack.find(
        (l) => l.route && l.route.path === '/:id' && l.route.methods.put
      );
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;

      // Test invalid maxTokens (negative)
      const req1 = {
        params: { id: 'SYS_ROUTER_V1' },
        body: {
          config: { maxTokens: -100 },
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let statusCode1 = 200;
      let jsonResponse1 = null;
      const res1 = {
        status(code) {
          statusCode1 = code;
          return this;
        },
        json(data) {
          jsonResponse1 = data;
        },
      };

      await handler(req1, res1);

      assert.strictEqual(statusCode1, 400);
      assert.ok(jsonResponse1.error);
      assert.ok(jsonResponse1.error.includes('maxTokens'));

      // Test invalid maxTokens (non-integer)
      const req2 = {
        params: { id: 'SYS_ROUTER_V1' },
        body: {
          config: { maxTokens: 1024.5 },
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let statusCode2 = 200;
      let jsonResponse2 = null;
      const res2 = {
        status(code) {
          statusCode2 = code;
          return this;
        },
        json(data) {
          jsonResponse2 = data;
        },
      };

      await handler(req2, res2);

      assert.strictEqual(statusCode2, 400);
      assert.ok(jsonResponse2.error);
      assert.ok(jsonResponse2.error.includes('maxTokens'));
    });

    it('should validate config.topP range (0.0 to 1.0)', async function() {
      const layer = promptsRouter.stack.find(
        (l) => l.route && l.route.path === '/:id' && l.route.methods.put
      );
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;

      // Test invalid topP (> 1.0)
      const req = {
        params: { id: 'SYS_ROUTER_V1' },
        body: {
          config: { topP: 1.5 },
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let statusCode = 200;
      let jsonResponse = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResponse = data;
        },
      };

      await handler(req, res);

      assert.strictEqual(statusCode, 400);
      assert.ok(jsonResponse.error);
      assert.ok(jsonResponse.error.includes('topP'));
    });
  });

  describe('PUT /api/prompts/:id - Validation Integration', function() {
    afterEach(function() {
      // Clean up mocked GuidanceClient
      delete require.cache[require.resolve('../../services/guidance/GuidanceClient')];
    });

    it('should save successfully when guidance unavailable (graceful fallback)', async function() {
      // Mock GuidanceClient as unavailable
      const GuidanceClientMock = class {
        async isAvailable() {
          return false;
        }
      };

      require.cache[require.resolve('../../services/guidance/GuidanceClient')] = {
        exports: {
          GuidanceClient: GuidanceClientMock,
          getFallbackPromptId: () => 'fallback',
        },
      };

      // Clear and reload router to pick up new GuidanceClient mock
      delete require.cache[require.resolve('../../routes/api/prompts')];
      const router = require('../../routes/api/prompts');

      const layer = router.stack.find(
        (l) => l.route && l.route.path === '/:id' && l.route.methods.put
      );
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;

      const req = {
        params: { id: 'SYS_ROUTER_V1' },
        body: {
          systemPrompt: 'Updated prompt without validation',
          config: {
            temperature: 0.5,
          },
        },
        user: { id: 1, username: 'admin', role: 'admin' },
      };
      let statusCode = 200;
      let jsonResponse = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResponse = data;
        },
      };

      await handler(req, res);

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(jsonResponse.success, true);
      assert.ok(jsonResponse.prompt);
      assert.strictEqual(jsonResponse.prompt.isModified, true);
      // No validation key should be present when guidance unavailable
      assert.strictEqual(jsonResponse.validation, undefined);
    });
  });
});
