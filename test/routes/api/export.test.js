/* eslint-env mocha */
const assert = require('assert');
const request = require('supertest');
const { createScopedRouteApp } = require('../../helpers/scoped-route-auth');

const RED_PIXEL_DATA_URI = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8Dw' +
  'HwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

function buildExportApp(user) {
  return createScopedRouteApp({
    routePath: require.resolve('../../../routes/api/export'),
    mountPath: '/api/export',
    user,
    jsonOptions: { limit: '50mb' },
  });
}

describe('Export API Routes', function () {
  let authApp;
  let unauthApp;

  before(function () {
    authApp = buildExportApp({ id: 1, username: 'testuser' });
    unauthApp = buildExportApp(null);
  });

  describe('POST /api/export/region', function () {
    it('exports region as PNG with valid base64 data', async function () {
      const response = await request(authApp)
        .post('/api/export/region')
        .send({
          documentId: 123,
          imageBase64: RED_PIXEL_DATA_URI,
          format: 'png',
        })
        .expect(200)
        .expect('Content-Type', /image\/png/);

      assert.ok(response.headers['content-disposition']);
      assert.ok(response.headers['content-disposition'].includes('region-doc123'));
      assert.ok(response.headers['content-disposition'].includes('.png'));
    });

    it('exports region as PDF with valid base64 data', async function () {
      const response = await request(authApp)
        .post('/api/export/region')
        .send({
          documentId: 456,
          imageBase64: RED_PIXEL_DATA_URI,
          metadata: { pageNumber: 2 },
          format: 'pdf',
        })
        .expect(200)
        .expect('Content-Type', /application\/pdf/);

      assert.ok(response.headers['content-disposition']);
      assert.ok(response.headers['content-disposition'].includes('region-doc456'));
      assert.ok(response.headers['content-disposition'].includes('.pdf'));
    });

    it('rejects missing imageBase64', async function () {
      const response = await request(authApp)
        .post('/api/export/region')
        .send({
          documentId: 123,
          format: 'png',
        })
        .expect(400);

      assert.ok(response.body.error.includes('Invalid image data'));
    });

    it('rejects invalid format', async function () {
      const response = await request(authApp)
        .post('/api/export/region')
        .send({
          documentId: 123,
          imageBase64: RED_PIXEL_DATA_URI,
          format: 'invalid',
        })
        .expect(400);

      assert.ok(response.body.error.includes('Invalid format'));
    });

    it('rejects data exceeding the 10MB decoded size limit', async function () {
      const largeData = 'A'.repeat(15 * 1024 * 1024);
      const response = await request(authApp)
        .post('/api/export/region')
        .send({
          documentId: 123,
          imageBase64: `data:image/png;base64,${largeData}`,
          format: 'png',
        })
        .expect(400);

      assert.ok(response.body.error.includes('Image too large'));
    });
  });

  describe('POST /api/export/text', function () {
    it('exports text as TXT with metadata header', async function () {
      const sampleText = 'This is a test document.\nWith multiple lines.\n';
      const response = await request(authApp)
        .post('/api/export/text')
        .send({
          text: sampleText,
          format: 'txt',
          metadata: {
            documentId: 789,
            title: 'Sample Doc',
            source: 'manual',
          },
        })
        .expect(200)
        .expect('Content-Type', /text\/plain/);

      assert.ok(response.headers['content-disposition']);
      assert.ok(response.headers['content-disposition'].includes('text-export-'));
      assert.ok(response.headers['content-disposition'].includes('.txt'));
      assert.ok(response.text.includes('Title: Sample Doc'));
      assert.ok(response.text.includes('Document ID: 789'));
      assert.ok(response.text.includes('Source: manual'));
      assert.ok(response.text.includes('Exported:'));
      assert.ok(response.text.includes(sampleText));
    });

    it('exports text as PDF with valid input', async function () {
      const response = await request(authApp)
        .post('/api/export/text')
        .send({
          text: 'PDF export test content.',
          format: 'pdf',
          metadata: { documentId: 100 },
        })
        .expect(200)
        .expect('Content-Type', /application\/pdf/);

      assert.ok(response.headers['content-disposition']);
      assert.ok(response.headers['content-disposition'].includes('text-export-'));
      assert.ok(response.headers['content-disposition'].includes('.pdf'));
    });

    it('rejects missing text field', async function () {
      const response = await request(authApp)
        .post('/api/export/text')
        .send({ format: 'txt' })
        .expect(400);

      assert.ok(response.body.error.includes('Invalid text content'));
    });

    it('rejects text exceeding 1MB limit', async function () {
      const response = await request(authApp)
        .post('/api/export/text')
        .send({
          text: 'A'.repeat(2 * 1024 * 1024),
          format: 'txt',
        })
        .expect(400);

      assert.ok(response.body.error.includes('Text too large'));
    });
  });

  describe('POST /api/export/annotations', function () {
    it('exports annotations as JSON with current response contract', async function () {
      const sampleAnnotations = [
        {
          id: 'ann-1',
          label: 'test-label',
          note: 'note-1',
          bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          pageNumber: 2,
          confirmed: true,
        },
        {
          id: 'ann-2',
          label: 'another-label',
          bbox: { x: 0.5, y: 0.6, width: 0.1, height: 0.1 },
        },
      ];

      const response = await request(authApp)
        .post('/api/export/annotations')
        .send({
          documentId: 555,
          annotations: sampleAnnotations,
        })
        .expect(200)
        .expect('Content-Type', /application\/json/);

      assert.ok(response.headers['content-disposition']);
      assert.ok(response.headers['content-disposition'].includes('annotations-doc555'));
      assert.ok(response.headers['content-disposition'].includes('.json'));

      const exportData = response.body;
      assert.strictEqual(exportData.documentId, 555);
      assert.strictEqual(exportData.annotationCount, 2);
      assert.strictEqual(exportData.format, 'paperless-ai-annotations-v1');
      assert.ok(exportData.exportedAt);
      assert.strictEqual(exportData.annotations.length, 2);
      assert.strictEqual(exportData.annotations[0].index, 1);
      assert.strictEqual(exportData.annotations[0].pageNumber, 2);
      assert.strictEqual(exportData.annotations[0].confirmed, true);
    });

    it('includes documentMetadata when includeMetadata is true', async function () {
      const response = await request(authApp)
        .post('/api/export/annotations')
        .send({
          documentId: 321,
          includeMetadata: true,
          annotations: [],
        })
        .expect(200);

      assert.ok(response.body.documentMetadata);
      assert.ok(
        response.body.documentMetadata.note.includes('not yet implemented')
      );
    });

    it('rejects missing annotations field', async function () {
      const response = await request(authApp)
        .post('/api/export/annotations')
        .send({ documentId: 123 })
        .expect(400);

      assert.ok(response.body.error.includes('annotations'));
    });

    it('rejects non-array annotations', async function () {
      const response = await request(authApp)
        .post('/api/export/annotations')
        .send({
          documentId: 123,
          annotations: 'not-an-array',
        })
        .expect(400);

      assert.ok(response.body.error.includes('annotations'));
    });

    it('rejects missing documentId', async function () {
      const response = await request(authApp)
        .post('/api/export/annotations')
        .send({ annotations: [] })
        .expect(400);

      assert.ok(response.body.error.includes('documentId'));
    });
  });

  describe('Authentication', function () {
    it('requires authentication for all export endpoints', async function () {
      await request(unauthApp)
        .post('/api/export/region')
        .send({
          imageBase64: RED_PIXEL_DATA_URI,
          format: 'png',
        })
        .expect(401);

      await request(unauthApp)
        .post('/api/export/text')
        .send({
          text: 'test',
          format: 'txt',
        })
        .expect(401);

      await request(unauthApp)
        .post('/api/export/annotations')
        .send({
          documentId: 1,
          annotations: [],
        })
        .expect(401);
    });
  });
});
