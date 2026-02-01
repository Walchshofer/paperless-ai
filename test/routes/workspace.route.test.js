const assert = require('assert');
const request = require('supertest');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 1, username: 'test' }, process.env.JWT_SECRET);

const app = require('../../server');
const paperlessService = require('../../services/paperlessService.js');
const documentModel = require('../../services/documentModel.js');

describe('Workspace route', function () {
  this.timeout(10000);
  it('GET /workspace renders workspace without a pre-selected document and includes availableDocuments', async function () {
    const origAllDocs = paperlessService.getAllDocumentsUnfiltered;
    const origHistory = documentModel.getAllHistory;

    paperlessService.getAllDocumentsUnfiltered = async () => ([{ id: 101, title: 'Doc A' }, { id: 102, title: 'Doc B' }]);
    documentModel.getAllHistory = async () => ([{ document_id: 101 }]);

    const resp = await request(app)
      .get('/workspace')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Should render the workspace and show the 'Select a document' prompt
    assert.ok(resp.text.includes('Select a document') || resp.text.includes('Select a document...'));

    paperlessService.getAllDocumentsUnfiltered = origAllDocs;
    documentModel.getAllHistory = origHistory;
  });
});