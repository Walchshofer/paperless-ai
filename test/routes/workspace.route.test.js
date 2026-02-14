/* eslint-env mocha */
const assert = require('assert');
const path = require('path');
const request = require('supertest');

const paperlessService = require('../../services/paperlessService.js');
const documentModel = require('../../services/documentModel.js');
const modelResolutionService = require('../../services/ModelResolutionService');
const { createScopedRouteApp } = require('../helpers/scoped-route-auth');

const VISUAL_RAG_CLIENT_PATH = require.resolve('../../services/visual-rag-client');

function buildWorkspaceApp(user) {
  return createScopedRouteApp({
    routePath: require.resolve('../../routes/workspace'),
    mountPath: '/workspace',
    user,
    jsonOptions: {},
    setupApp: (app) => {
      app.set('views', path.join(process.cwd(), 'views'));
      app.set('view engine', 'ejs');
    },
  });
}

describe('Workspace route', function () {
  this.timeout(10000);

  let originalGetAllDocumentsUnfiltered;
  let originalGetAllHistory;
  let originalGetAllModels;
  let originalGetExpertModels;
  let originalVisualRagClientModule;

  beforeEach(function () {
    originalGetAllDocumentsUnfiltered = paperlessService.getAllDocumentsUnfiltered;
    originalGetAllHistory = documentModel.getAllHistory;
    originalGetAllModels = modelResolutionService.getAllModels;
    originalGetExpertModels = modelResolutionService.getExpertModels;
    originalVisualRagClientModule = require.cache[VISUAL_RAG_CLIENT_PATH];

    // Avoid sidecar/repository initialization during route import in this suite.
    require.cache[VISUAL_RAG_CLIENT_PATH] = {
      id: VISUAL_RAG_CLIENT_PATH,
      filename: VISUAL_RAG_CLIENT_PATH,
      loaded: true,
      exports: { visualOverlayRepository: null },
    };

    paperlessService.getAllDocumentsUnfiltered = async () => ([
      { id: 101, title: 'Doc A', original_file_name: 'doc-a.pdf' },
      { id: 102, title: 'Doc B', original_file_name: 'doc-b.pdf' },
    ]);
    documentModel.getAllHistory = async () => ([{ document_id: 101 }]);
    modelResolutionService.getAllModels = async () => ({
      ollama: ['sauerkraut-llama3.1:8b'],
    });
    modelResolutionService.getExpertModels = () => [];
  });

  afterEach(function () {
    paperlessService.getAllDocumentsUnfiltered = originalGetAllDocumentsUnfiltered;
    documentModel.getAllHistory = originalGetAllHistory;
    modelResolutionService.getAllModels = originalGetAllModels;
    modelResolutionService.getExpertModels = originalGetExpertModels;

    if (originalVisualRagClientModule) {
      require.cache[VISUAL_RAG_CLIENT_PATH] = originalVisualRagClientModule;
    } else {
      delete require.cache[VISUAL_RAG_CLIENT_PATH];
    }
  });

  it('GET /workspace redirects to /login when unauthenticated', async function () {
    const app = buildWorkspaceApp(null);
    const resp = await request(app).get('/workspace').expect(302);
    assert.strictEqual(resp.headers.location, '/login');
  });

  it(
    'GET /workspace renders without pre-selected document and includes docs',
    async function () {
      const app = buildWorkspaceApp({ id: 1, username: 'test', role: 'user' });

      const resp = await request(app).get('/workspace').expect(200);

      assert.ok(
        resp.text.includes('Select a document') ||
          resp.text.includes('Select a document...')
      );
      assert.ok(resp.text.includes('Doc A'));
      assert.ok(resp.text.includes('Doc B'));
    }
  );
});
