/* eslint-env mocha */
/**
 * FINDING-12 — GET /api/documents/correspondents
 *
 * Tests the correspondents route in routes/api/documents.js.
 * Verifies success/failure response shapes and that the route is registered
 * BEFORE the /:id wildcard so "correspondents" is not treated as a document id.
 *
 * Uses supertest + the scoped-route-auth helper (same pattern as
 * test/routes/api/export.test.js).
 * Uses Node.js built-in assert only.
 */

'use strict';

const assert = require('assert');
const request = require('supertest');
const { createScopedRouteApp } = require('../../helpers/scoped-route-auth');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROUTE_PATH = require.resolve('../../../routes/api/documents');
const MOUNT_PATH = '/api/documents';

/**
 * Build the route app with a mock paperlessService injected via require.cache.
 * @param {Object} paperlessServiceMock - partial paperlessService mock
 * @param {Object} [user] - authenticated user (defaults to regular user)
 */
function buildApp(paperlessServiceMock, user = { id: 1, username: 'testuser', role: 'user' }) {
  const paperlessServicePath = require.resolve('../../../services/paperlessService');

  // Inject mock before loading route — must also inject other heavy deps
  // that documents.js requires at load time, to avoid real service calls.
  const loggerPath = require.resolve('../../../services/logger');
  const configPath = require.resolve('../../../config/config');
  const docModelPath = require.resolve('../../../services/documentModel');
  const pdfRendererPath = require.resolve('../../../services/visual-rag-client/PDFRenderer');
  const expertExecutorPath = require.resolve('../../../services/experts/ExpertPipelineExecutor');
  const docProcessorPath = require.resolve('../../../services/integration/DocumentProcessor');
  const brokerPath = require.resolve('../../../services/reprocess/ReprocessProgressBroker');
  const aiFactoryPath = require.resolve('../../../services/aiServiceFactory');

  const savedPaperless = require.cache[paperlessServicePath];
  const savedLogger = require.cache[loggerPath];
  const _savedConfig = require.cache[configPath];
  const _savedDocModel = require.cache[docModelPath];

  // Minimal mocks for heavy dependencies so the route loads cleanly
  if (!savedLogger) {
    require.cache[loggerPath] = {
      id: loggerPath, filename: loggerPath, loaded: true,
      exports: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }
    };
  }

  if (!require.cache[configPath]) {
    require.cache[configPath] = {
      id: configPath, filename: configPath, loaded: true,
      exports: { get: () => null, getAll: () => ({}) }
    };
  }

  if (!require.cache[docModelPath]) {
    require.cache[docModelPath] = {
      id: docModelPath, filename: docModelPath, loaded: true,
      exports: {}
    };
  }

  if (!require.cache[pdfRendererPath]) {
    require.cache[pdfRendererPath] = {
      id: pdfRendererPath, filename: pdfRendererPath, loaded: true,
      exports: { pdfRenderer: {}, isSupportedImageMimeType: () => false }
    };
  }

  if (!require.cache[expertExecutorPath]) {
    require.cache[expertExecutorPath] = {
      id: expertExecutorPath, filename: expertExecutorPath, loaded: true,
      exports: { ExpertPipelineExecutor: class {} }
    };
  }

  if (!require.cache[docProcessorPath]) {
    require.cache[docProcessorPath] = {
      id: docProcessorPath, filename: docProcessorPath, loaded: true,
      exports: { DocumentProcessor: class {} }
    };
  }

  if (!require.cache[brokerPath]) {
    require.cache[brokerPath] = {
      id: brokerPath, filename: brokerPath, loaded: true,
      exports: {
        REPROCESS_ERROR_MESSAGES: {},
        REPROCESS_STAGE_DEFINITIONS: {},
        reprocessProgressBroker: { publish: () => null }
      }
    };
  }

  if (!require.cache[aiFactoryPath]) {
    require.cache[aiFactoryPath] = {
      id: aiFactoryPath, filename: aiFactoryPath, loaded: true,
      exports: { getAIService: () => ({}) }
    };
  }

  // Inject paperlessService mock
  require.cache[paperlessServicePath] = {
    id: paperlessServicePath, filename: paperlessServicePath, loaded: true,
    exports: paperlessServiceMock
  };

  const app = createScopedRouteApp({
    routePath: ROUTE_PATH,
    mountPath: MOUNT_PATH,
    user
  });

  // Restore after loading
  if (savedPaperless) {
    require.cache[paperlessServicePath] = savedPaperless;
  } else {
    delete require.cache[paperlessServicePath];
  }

  return app;
}

// ---------------------------------------------------------------------------
// Tests — happy path
// ---------------------------------------------------------------------------

describe('GET /api/documents/correspondents — happy path', () => {
  let app;

  before(() => {
    const mockCorrespondents = [
      { name: 'ACME Corp', id: 1, document_count: 5 },
      { name: 'Example GmbH', id: 2, document_count: 12 }
    ];
    app = buildApp({
      listCorrespondentsNames: async () => mockCorrespondents
    });
  });

  it('returns HTTP 200', async () => {
    const res = await request(app).get('/api/documents/correspondents');
    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}`);
  });

  it('returns success:true', async () => {
    const res = await request(app).get('/api/documents/correspondents');
    assert.strictEqual(res.body.success, true, 'success must be true on happy path');
  });

  it('returns correspondents as an array', async () => {
    const res = await request(app).get('/api/documents/correspondents');
    assert.ok(Array.isArray(res.body.correspondents), 'correspondents must be an array');
  });

  it('returns correspondent data with name, id, document_count fields', async () => {
    const res = await request(app).get('/api/documents/correspondents');
    const first = res.body.correspondents[0];
    assert.ok(first, 'at least one correspondent must be returned');
    assert.strictEqual(first.name, 'ACME Corp', 'first correspondent name must match');
    assert.strictEqual(first.id, 1, 'first correspondent id must match');
    assert.strictEqual(first.document_count, 5, 'document_count must match');
  });

  it('returns all correspondents from the service', async () => {
    const res = await request(app).get('/api/documents/correspondents');
    assert.strictEqual(res.body.correspondents.length, 2, 'all 2 correspondents must be returned');
  });
});

// ---------------------------------------------------------------------------
// Tests — error path
// ---------------------------------------------------------------------------

describe('GET /api/documents/correspondents — service throws', () => {
  let app;

  before(() => {
    app = buildApp({
      listCorrespondentsNames: async () => { throw new Error('Paperless API unreachable'); }
    });
  });

  it('returns HTTP 500 when service throws', async () => {
    const res = await request(app).get('/api/documents/correspondents');
    assert.strictEqual(res.status, 500, `Expected 500 but got ${res.status}`);
  });

  it('returns success:false when service throws', async () => {
    const res = await request(app).get('/api/documents/correspondents');
    assert.strictEqual(res.body.success, false, 'success must be false when service fails');
  });

  it('returns empty correspondents array when service throws', async () => {
    const res = await request(app).get('/api/documents/correspondents');
    assert.ok(Array.isArray(res.body.correspondents), 'correspondents must still be an array');
    assert.strictEqual(res.body.correspondents.length, 0, 'correspondents must be empty on error');
  });

  it('includes error field in response when service throws', async () => {
    const res = await request(app).get('/api/documents/correspondents');
    assert.ok(typeof res.body.error === 'string', 'error field must be a string');
    assert.ok(
      res.body.error.includes('Paperless API unreachable'),
      'error message must contain the original error message'
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — route ordering (correspondents is NOT treated as /:id)
// ---------------------------------------------------------------------------

describe('GET /api/documents/correspondents — route ordering', () => {
  it('GET /api/documents/correspondents does not 404 (route registered before /:id wildcard)', async () => {
    // If /:id wildcard was hit, it would try to look up a document by id="correspondents"
    // and likely return an error shape. We confirm the route exists and responds with
    // the correspondents-specific response shape (success + correspondents array).
    const app = buildApp({ listCorrespondentsNames: async () => [] });
    const res = await request(app).get('/api/documents/correspondents');
    // Must NOT be 404
    assert.notStrictEqual(res.status, 404, 'Route must not 404 (must be registered before /:id wildcard)');
    // Must have correspondents key (not a document object)
    assert.ok('correspondents' in res.body, 'Response must have correspondents key (not a doc-by-id response)');
  });
});

// ---------------------------------------------------------------------------
// Tests — empty correspondent list
// ---------------------------------------------------------------------------

describe('GET /api/documents/correspondents — empty list', () => {
  it('returns success:true and empty array when no correspondents exist', async () => {
    const app = buildApp({ listCorrespondentsNames: async () => [] });
    const res = await request(app).get('/api/documents/correspondents');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.deepStrictEqual(res.body.correspondents, []);
  });
});
