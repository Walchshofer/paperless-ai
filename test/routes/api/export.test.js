/**
 * Unit Tests for Export API Routes
 * 
 * Tests the three export endpoints:
 * - POST /api/export/region
 * - POST /api/export/text
 * - POST /api/export/annotations
 * 
 * @module test/routes/api/export.test
 */

const assert = require('assert');
const request = require('supertest');
const express = require('express');

// Mock the authenticateApi middleware
const mockAuth = (req, res, next) => {
  req.user = { id: 1, username: 'testuser' };
  next();
};

describe('Export API Routes', function() {
  let app;
  let exportRoutes;

  before(function() {
    // Create Express app for testing
    app = express();
    app.use(express.json({ limit: '50mb' }));
    
    // Load the export routes
    exportRoutes = require('../../routes/api/export');
    
    // Mount with mock auth middleware
    app.use('/api/export', mockAuth, exportRoutes);
  });

  describe('POST /api/export/region', function() {
    it('should export region as PNG with valid base64 data', async function() {
      // Create a small 1x1 red pixel PNG as base64
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      const dataUri = `data:image/png;base64,${base64Data}`;

      const response = await request(app)
        .post('/api/export/region')
        .send({
          documentId: 123,
          page: 1,
          imageData: dataUri,
          format: 'png'
        })
        .expect(200)
        .expect('Content-Type', /image\/png/);

      // Check Content-Disposition header
      assert.ok(response.headers['content-disposition']);
      assert.ok(response.headers['content-disposition'].includes('region-doc123'));
      assert.ok(response.headers['content-disposition'].includes('.png'));
    });

    it('should export region as PDF with valid base64 data', async function() {
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      const dataUri = `data:image/png;base64,${base64Data}`;

      const response = await request(app)
        .post('/api/export/region')
        .send({
          documentId: 456,
          page: 2,
          imageData: dataUri,
          format: 'pdf'
        })
        .expect(200)
        .expect('Content-Type', /application\/pdf/);

      // Check Content-Disposition header
      assert.ok(response.headers['content-disposition']);
      assert.ok(response.headers['content-disposition'].includes('region-doc456'));
      assert.ok(response.headers['content-disposition'].includes('.pdf'));
    });

    it('should reject missing imageData', async function() {
      const response = await request(app)
        .post('/api/export/region')
        .send({
          documentId: 123,
          format: 'png'
        })
        .expect(400);

      assert.ok(response.body.error);
      assert.ok(response.body.error.includes('imageData'));
    });

    it('should reject invalid format', async function() {
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      const dataUri = `data:image/png;base64,${base64Data}`;

      const response = await request(app)
        .post('/api/export/region')
        .send({
          documentId: 123,
          imageData: dataUri,
          format: 'invalid'
        })
        .expect(400);

      assert.ok(response.body.error);
      assert.ok(response.body.error.includes('format'));
    });

    it('should reject data exceeding 10MB limit', async function() {
      // Create a large base64 string (>10MB)
      const largeData = 'A'.repeat(11 * 1024 * 1024); // 11MB
      const dataUri = `data:image/png;base64,${largeData}`;

      const response = await request(app)
        .post('/api/export/region')
        .send({
          documentId: 123,
          imageData: dataUri,
          format: 'png'
        })
        .expect(400);

      assert.ok(response.body.error);
      assert.ok(response.body.error.toLowerCase().includes('size'));
    });
  });

  describe('POST /api/export/text', function() {
    it('should export text as TXT with valid input', async function() {
      const sampleText = 'This is a test document.\nWith multiple lines.\n';

      const response = await request(app)
        .post('/api/export/text')
        .send({
          documentId: 789,
          page: 3,
          text: sampleText,
          format: 'txt'
        })
        .expect(200)
        .expect('Content-Type', /text\/plain/);

      // Check Content-Disposition header
      assert.ok(response.headers['content-disposition']);
      assert.ok(response.headers['content-disposition'].includes('text-doc789'));
      assert.ok(response.headers['content-disposition'].includes('.txt'));

      // Check response includes the text
      assert.ok(response.text.includes(sampleText));
    });

    it('should export text as PDF with valid input', async function() {
      const sampleText = 'PDF export test content.';

      const response = await request(app)
        .post('/api/export/text')
        .send({
          documentId: 100,
          text: sampleText,
          format: 'pdf'
        })
        .expect(200)
        .expect('Content-Type', /application\/pdf/);

      // Check Content-Disposition header
      assert.ok(response.headers['content-disposition']);
      assert.ok(response.headers['content-disposition'].includes('text-doc100'));
      assert.ok(response.headers['content-disposition'].includes('.pdf'));
    });

    it('should reject missing text field', async function() {
      const response = await request(app)
        .post('/api/export/text')
        .send({
          documentId: 123,
          format: 'txt'
        })
        .expect(400);

      assert.ok(response.body.error);
      assert.ok(response.body.error.includes('text'));
    });

    it('should reject text exceeding 1MB limit', async function() {
      // Create a large text string (>1MB)
      const largeText = 'A'.repeat(2 * 1024 * 1024); // 2MB

      const response = await request(app)
        .post('/api/export/text')
        .send({
          documentId: 123,
          text: largeText,
          format: 'txt'
        })
        .expect(400);

      assert.ok(response.body.error);
      assert.ok(response.body.error.toLowerCase().includes('size'));
    });

    it('should include metadata header in TXT export', async function() {
      const sampleText = 'Test content.';

      const response = await request(app)
        .post('/api/export/text')
        .send({
          documentId: 999,
          page: 5,
          text: sampleText,
          format: 'txt'
        })
        .expect(200);

      // Check for metadata markers
      assert.ok(response.text.includes('Document ID: 999'));
      assert.ok(response.text.includes('Page: 5'));
      assert.ok(response.text.includes('Export Date:'));
    });
  });

  describe('POST /api/export/annotations', function() {
    it('should export annotations as JSON with valid input', async function() {
      const sampleAnnotations = [
        {
          id: 'ann-1',
          bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          label: 'test-label'
        },
        {
          id: 'ann-2',
          bbox: { x: 0.5, y: 0.6, width: 0.1, height: 0.1 },
          label: 'another-label'
        }
      ];

      const response = await request(app)
        .post('/api/export/annotations')
        .send({
          documentId: 555,
          annotations: sampleAnnotations
        })
        .expect(200)
        .expect('Content-Type', /application\/json/);

      // Check Content-Disposition header
      assert.ok(response.headers['content-disposition']);
      assert.ok(response.headers['content-disposition'].includes('annotations-doc555'));
      assert.ok(response.headers['content-disposition'].includes('.json'));

      // Parse JSON response
      const exportData = response.body;
      assert.strictEqual(exportData.documentId, 555);
      assert.strictEqual(exportData.count, 2);
      assert.strictEqual(exportData.annotations.length, 2);
      assert.ok(exportData.exportedAt);
      assert.strictEqual(exportData.formatVersion, '1.0');
    });

    it('should normalize bbox coordinates', async function() {
      const annotations = [
        {
          id: 'ann-1',
          bbox: { x: 100, y: 200, width: 50, height: 75 },
          label: 'test'
        }
      ];

      const response = await request(app)
        .post('/api/export/annotations')
        .send({
          documentId: 123,
          annotations
        })
        .expect(200);

      const exportData = response.body;
      const normalized = exportData.annotations[0].bbox;

      // Check that bbox was normalized to 0-1 range
      assert.ok(normalized.x >= 0 && normalized.x <= 1, 'x should be normalized');
      assert.ok(normalized.y >= 0 && normalized.y <= 1, 'y should be normalized');
      assert.ok(normalized.width >= 0 && normalized.width <= 1, 'width should be normalized');
      assert.ok(normalized.height >= 0 && normalized.height <= 1, 'height should be normalized');
    });

    it('should reject missing annotations field', async function() {
      const response = await request(app)
        .post('/api/export/annotations')
        .send({
          documentId: 123
        })
        .expect(400);

      assert.ok(response.body.error);
      assert.ok(response.body.error.includes('annotations'));
    });

    it('should reject non-array annotations', async function() {
      const response = await request(app)
        .post('/api/export/annotations')
        .send({
          documentId: 123,
          annotations: 'not-an-array'
        })
        .expect(400);

      assert.ok(response.body.error);
      assert.ok(response.body.error.includes('annotations'));
    });

    it('should handle empty annotations array', async function() {
      const response = await request(app)
        .post('/api/export/annotations')
        .send({
          documentId: 123,
          annotations: []
        })
        .expect(200);

      const exportData = response.body;
      assert.strictEqual(exportData.count, 0);
      assert.strictEqual(exportData.annotations.length, 0);
    });
  });

  describe('Authentication', function() {
    it('should require authentication for all export endpoints', async function() {
      // Create app without auth middleware
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.use('/api/export', exportRoutes);

      // All endpoints should return 401
      await request(unauthApp)
        .post('/api/export/region')
        .send({ imageData: 'test', format: 'png' })
        .expect(401);

      await request(unauthApp)
        .post('/api/export/text')
        .send({ text: 'test', format: 'txt' })
        .expect(401);

      await request(unauthApp)
        .post('/api/export/annotations')
        .send({ annotations: [], documentId: 1 })
        .expect(401);
    });
  });
});
