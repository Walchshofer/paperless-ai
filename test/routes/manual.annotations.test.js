/* eslint-env mocha */
const assert = require('assert');
const request = require('supertest');
const annotationService = require('../../services/AnnotationService');
const { createScopedRouteApp } = require('../helpers/scoped-route-auth');

function buildAnnotationsApp(user) {
  return createScopedRouteApp({
    routePath: require.resolve('../../routes/api/annotations'),
    mountPath: '/api/annotations',
    user,
    jsonOptions: {},
  });
}

describe('Annotations API endpoints', function () {
  it('POST /api/annotations returns 401 when unauthenticated', async function () {
    const app = buildAnnotationsApp(null);

    await request(app)
      .post('/api/annotations')
      .send({
        documentId: 123,
        page: 1,
        annotations: [{ bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 } }],
      })
      .expect(401);
  });

  it('POST /api/annotations saves annotations for authenticated user', async function () {
    const app = buildAnnotationsApp({ id: 1, username: 'test' });
    const fakeSaved = { id: 'uuid-1', user_id: 1, document_id: 123, page: 1, bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 }, label: 'Test', note: null };
    const origSave = annotationService.saveAnnotation;
    try {
      annotationService.saveAnnotation = async () => fakeSaved;

      const resp = await request(app)
        .post('/api/annotations')
        .send({ documentId: 123, page: 1, annotations: [{ bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 }, label: 'Test' }] })
        .expect(200);

      assert.strictEqual(resp.body.success, true);
      assert.ok(Array.isArray(resp.body.created));
      assert.strictEqual(resp.body.created[0].label, 'Test');
    } finally {
      annotationService.saveAnnotation = origSave;
    }
  });

  it('GET /api/annotations/:documentId returns annotations', async function () {
    const app = buildAnnotationsApp({ id: 1, username: 'test' });
    const fakeList = [{ id: 'uuid-2', user_id: 1, document_id: 200, page: 2, bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 }, label: 'A' }];
    const origLoad = annotationService.loadAnnotations;
    try {
      annotationService.loadAnnotations = async () => fakeList;

      const resp = await request(app)
        .get('/api/annotations/200?page=2')
        .expect(200);

      assert.ok(Array.isArray(resp.body.annotations));
      assert.strictEqual(resp.body.annotations[0].label, 'A');
    } finally {
      annotationService.loadAnnotations = origLoad;
    }
  });

  it('DELETE /api/annotations/:id deletes annotation when authorized', async function () {
    const app = buildAnnotationsApp({ id: 1, username: 'test' });
    const origDel = annotationService.deleteAnnotation;
    try {
      annotationService.deleteAnnotation = async () => ({ success: true });

      const resp = await request(app)
        .delete('/api/annotations/uuid-3')
        .expect(200);

      assert.strictEqual(resp.body.success, true);
    } finally {
      annotationService.deleteAnnotation = origDel;
    }
  });

  it('PUT /api/annotations/:id updates annotation', async function () {
    const app = buildAnnotationsApp({ id: 1, username: 'test' });
    const updated = { id: 'uuid-4', label: 'Updated' };
    const origPut = annotationService.updateAnnotation;
    try {
      annotationService.updateAnnotation = async () => updated;

      const resp = await request(app)
        .put('/api/annotations/uuid-4')
        .send({ label: 'Updated' })
        .expect(200);

      assert.strictEqual(resp.body.success, true);
      assert.strictEqual(resp.body.annotation.label, 'Updated');
    } finally {
      annotationService.updateAnnotation = origPut;
    }
  });
});
