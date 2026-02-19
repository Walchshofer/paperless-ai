/* eslint-env mocha */
const assert = require('assert');
const express = require('express');

describe('Prompts Runtime API - Variable Mapping and Execution Tracking', function() {
  let promptsRuntimeRouter;
  
  before(function() {
    // Mock auth middleware
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
    
    // Reset cache to ensure our mock is used
    delete require.cache[require.resolve('../../routes/api/prompts-runtime')];
    promptsRuntimeRouter = require('../../routes/api/prompts-runtime');
  });
  
  describe('Variable Mapping', function() {
    const helpers = require('../../routes/api/prompts-runtime')._helpers;

    it('should map ocr_text from result.ocr.text', function() {
      const pipelineResult = {
        success: true,
        result: { ocr: { text: 'Sample OCR text' } },
        metadata: {}
      };
      const variables = ['ocr_text'];
      
      const mapped = helpers.mapPipelineContextToVariables(pipelineResult, variables);
      assert.strictEqual(mapped.ocr_text, 'Sample OCR text');
    });
    
    it('should map domain from result.classification.classification.primary_domain', function() {
      const pipelineResult = {
        success: true,
        result: {
          classification: {
            classification: { primary_domain: 'medical' }
          }
        },
        metadata: {}
      };
      const variables = ['domain'];
      
      const mapped = helpers.mapPipelineContextToVariables(pipelineResult, variables);
      assert.strictEqual(mapped.domain, 'medical');
    });
    
    it('should return fallback for unmapped variables', function() {
      const pipelineResult = {
        success: true,
        result: {},
        metadata: {}
      };
      const variables = ['unknown_var'];
      
      const mapped = helpers.mapPipelineContextToVariables(pipelineResult, variables);
      assert.strictEqual(mapped.unknown_var, '[unmapped: unknown_var]');
    });
    
    it('should map all variables from mapping table', function() {
      const pipelineResult = {
        success: true,
        result: {
          ocr: { text: 'OCR content' },
          classification: {
            classification: {
              primary_domain: 'financial',
              doc_type_hint: 'invoice'
            }
          },
          document: {
            filename: 'test.pdf',
            title: 'Test Document'
          },
          extraction: { field1: 'value1' },
          visualElements: [{ type: 'table' }]
        },
        metadata: { confidence: 0.9 }
      };
      const variables = [
        'ocr_text', 'domain', 'document_type', 'filename',
        'source_system', 'extraction_result', 'visual_fields', 'confidence'
      ];
      
      const mapped = helpers.mapPipelineContextToVariables(pipelineResult, variables);
      
      assert.strictEqual(mapped.ocr_text, 'OCR content');
      assert.strictEqual(mapped.domain, 'financial');
      assert.strictEqual(mapped.document_type, 'invoice');
      assert.strictEqual(mapped.filename, 'test.pdf');
      assert.strictEqual(mapped.source_system, 'test-lab');
      assert.strictEqual(mapped.extraction_result, '{"field1":"value1"}');
      assert.strictEqual(mapped.visual_fields, '[{"type":"table"}]');
      assert.strictEqual(mapped.confidence, '0.9');
    });
  });
  
  describe('Per-User Execution Tracking', function() {
    const helpers = require('../../routes/api/prompts-runtime')._helpers;

    beforeEach(function() {
      helpers.activeExecutions.clear();
    });

    it('should allow first execution', function() {
      const userId = 'user1';
      assert.strictEqual(helpers.hasActiveExecution(userId), false);
    });
    
    it('should reject concurrent execution from same user', function() {
      const userId = 'user2';
      const promise = new Promise(resolve => setTimeout(resolve, 100));
      
      helpers.registerExecution(userId, promise, 123);
      assert.strictEqual(helpers.hasActiveExecution(userId), true);
    });
    
    it('should cleanup after execution completes', async function() {
      const userId = 'user3';
      const promise = Promise.resolve();
      
      helpers.registerExecution(userId, promise, 123);
      assert.strictEqual(helpers.hasActiveExecution(userId), true);
      
      await promise;
      // Wait for finally() to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      assert.strictEqual(helpers.hasActiveExecution(userId), false);
    });
    
    it('should cleanup after execution fails', async function() {
      const userId = 'user4';
      const promise = Promise.reject(new Error('Test error'));
      
      helpers.registerExecution(userId, promise, 123);
      assert.strictEqual(helpers.hasActiveExecution(userId), true);
      
      try {
        await promise;
      } catch (err) {
        // Expected error
      }
      
      // Wait for finally() to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      assert.strictEqual(helpers.hasActiveExecution(userId), false);
    });
  });
  
  describe('Error Formatting', function() {
    const helpers = require('../../routes/api/prompts-runtime')._helpers;

    it('should format pipeline errors with stage breakdown', function() {
      const pipelineResult = {
        success: false,
        quality: {
          errors: [
            { stage: 'ocr', error: 'Timeout', duration: 5000 },
            { stage: 'classification', error: 'Model unavailable', duration: 1000 }
          ]
        }
      };
      
      const formatted = helpers.formatPipelineError(pipelineResult);
      
      assert.strictEqual(formatted.message, 'Pipeline execution failed');
      assert.strictEqual(formatted.stages.length, 2);
      assert.strictEqual(formatted.stages[0].name, 'ocr');
      assert.strictEqual(formatted.stages[0].status, 'error');
      assert.strictEqual(formatted.stages[0].error, 'Timeout');
      assert.strictEqual(formatted.stages[1].name, 'classification');
    });
  });
  
  describe('POST /context endpoint', function() {
    it('should return 400 for missing documentId', async function() {
      const layer = promptsRuntimeRouter.stack.find(
        (l) => l.route && l.route.path === '/context' && l.route.methods.post
      );
      assert.ok(layer, 'Could not find /context POST layer');
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;
      
      const req = {
        body: { promptId: 'SYS_ROUTER_V1' },
        user: { id: 1, username: 'admin', role: 'admin' }
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
        }
      };
      
      await handler(req, res);
      
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(jsonResponse.success, false);
      assert.ok(jsonResponse.error.includes('Missing required fields'));
    });
    
    it('should return 404 for invalid promptId', async function() {
      const layer = promptsRuntimeRouter.stack.find(
        (l) => l.route && l.route.path === '/context' && l.route.methods.post
      );
      const handler = layer.route.stack[layer.route.stack.length - 1].handle;
      
      const req = {
        body: { documentId: 123, promptId: 'NONEXISTENT' },
        user: { id: 1, username: 'admin', role: 'admin' }
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
        }
      };
      
      await handler(req, res);
      
      assert.strictEqual(statusCode, 404);
      assert.strictEqual(jsonResponse.success, false);
      assert.ok(jsonResponse.error.includes('Prompt not found'));
    });
  });
});
