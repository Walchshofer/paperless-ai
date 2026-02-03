const assert = require('assert');
const request = require('supertest');
// Ensure API key and JWT secret for authentication in tests
process.env.API_KEY = process.env.API_KEY || 'testkey';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 1, username: 'test' }, process.env.JWT_SECRET);

const app = require('../../server');
const annotationService = require('../../services/AnnotationService');

describe('Annotations API endpoints', function () {
  afterEach(() => {
    // restore any overwritten methods
    // noop - tests individually restore
  });

  it('POST /api/annotations saves annotations for authenticated user', async function () {
    const fakeSaved = { id: 'uuid-1', user_id: 1, document_id: 123, page: 1, bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 }, label: 'Test', note: null };
    const origSave = annotationService.saveAnnotation;
    annotationService.saveAnnotation = async () => fakeSaved;

    const resp = await request(app)
      .post('/api/annotations')
      .set('Authorization', `Bearer ${token}`)
      .send({ documentId: 123, page: 1, annotations: [{ bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 }, label: 'Test' }] })
      .expect(200);

    assert.strictEqual(resp.body.success, true);
    assert.ok(Array.isArray(resp.body.created));
    assert.strictEqual(resp.body.created[0].label, 'Test');
    annotationService.saveAnnotation = origSave;
  });

  it('GET /api/annotations/:documentId returns annotations', async function () {
    const fakeList = [{ id: 'uuid-2', user_id: 1, document_id: 200, page: 2, bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 }, label: 'A' }];
    const origLoad = annotationService.loadAnnotations;
    annotationService.loadAnnotations = async () => fakeList;

    const resp = await request(app)
      .get('/api/annotations/200?page=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.ok(Array.isArray(resp.body.annotations));
    assert.strictEqual(resp.body.annotations[0].label, 'A');
    annotationService.loadAnnotations = origLoad;
  });

  it('DELETE /api/annotations/:id deletes annotation when authorized', async function () {
    const origDel = annotationService.deleteAnnotation;
    annotationService.deleteAnnotation = async () => ({ success: true });

    const resp = await request(app)
      .delete('/api/annotations/uuid-3')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.strictEqual(resp.body.success, true);
    annotationService.deleteAnnotation = origDel;
  });

  it('PUT /api/annotations/:id updates annotation', async function () {
    const updated = { id: 'uuid-4', label: 'Updated' };
    const origPut = annotationService.updateAnnotation;
    annotationService.updateAnnotation = async () => updated;

    const resp = await request(app)
      .put('/api/annotations/uuid-4')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Updated' })
      .expect(200);

    assert.strictEqual(resp.body.success, true);
    assert.strictEqual(resp.body.annotation.label, 'Updated');
    annotationService.updateAnnotation = origPut;
  });
});
