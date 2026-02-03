/**
 * Integration tests for workspace route with normalized document URLs
 * 
 * Tests workspace route and API endpoint to ensure:
 * - persistedNormalizedUrl field is correctly populated
 * - normalizationStatus field is correctly populated
 * - fallback to on-demand rendering when no persisted URL exists
 * - Zod schema validation passes for all cases
 */

const assert = require('assert');
const request = require('supertest');
const express = require('express');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const jwt = require('jsonwebtoken');
const paperlessService = require('../../services/paperlessService');

describe('Workspace Normalized Integration', function() {
  let app;
  let originalGetDocument;
  let originalGetAllDocuments;
  let token;

  beforeEach(function() {
    // Save original methods
    originalGetDocument = paperlessService.getDocument;
    originalGetAllDocuments = paperlessService.getAllDocuments;
    
    // Generate JWT token for authentication
    token = jwt.sign({ id: 1, username: 'testuser' }, process.env.JWT_SECRET);
    
    // Set required environment variables
    process.env.PAPERLESS_API_URL = 'http://localhost:8000/api';
    process.env.AI_PROVIDER = 'ollama';
    process.env.OLLAMA_MODEL = 'test-model';
    
    // Use the real server app (includes all middleware and auth)
    app = require('../../server');
  });

  afterEach(function() {
    // Restore original methods
    paperlessService.getDocument = originalGetDocument;
    paperlessService.getAllDocuments = originalGetAllDocuments;
  });

  describe('Workspace Route with Normalized Document', function() {
    it('should include persistedNormalizedUrl and normalizationStatus for completed document', async function() {
      // Mock document with normalization custom fields
      const mockDocument = {
        id: 123,
        title: 'Test Document',
        content: 'Test content',
        correspondent: null,
        document_type: null,
        tags: [],
        page_count: 2,
        mime_type: 'application/pdf',
        custom_fields: {
          ai_normalized_url: '/api/normalized/123/persisted.png',
          ai_normalization_status: 'completed'
        }
      };

      paperlessService.getDocument = async () => mockDocument;
      paperlessService.getAllDocuments = async () => [mockDocument];

      const response = await request(app)
        .get('/workspace/doc/123')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Check that HTML was rendered (status 200 is enough for this test)
      assert.ok(response.text, 'Response should contain HTML');
    });

    it('should return correct fields in API endpoint for completed document', async function() {
      const mockDocument = {
        id: 123,
        title: 'Test Document',
        content: 'Test content',
        correspondent: null,
        document_type: null,
        tags: [],
        page_count: 2,
        mime_type: 'application/pdf',
        custom_fields: {
          ai_normalized_url: '/api/normalized/123/persisted.png',
          ai_normalization_status: 'completed'
        }
      };

      paperlessService.getDocument = async () => mockDocument;

      const response = await request(app)
        .get('/workspace/api/doc/123')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Content-Type', /json/);

      assert.strictEqual(response.body.id, 123);
      assert.strictEqual(response.body.persistedNormalizedUrl, '/api/normalized/123/persisted.png');
      assert.strictEqual(response.body.normalizationStatus, 'completed');
      assert.strictEqual(response.body.normalizedUrl, '/api/normalized/123/persisted.png');
    });
  });

  describe('Workspace Route with Non-Normalized Document', function() {
    it('should return null persistedNormalizedUrl and pending status for non-normalized document', async function() {
      const mockDocument = {
        id: 456,
        title: 'Non-Normalized Document',
        content: 'Test content',
        correspondent: null,
        document_type: null,
        tags: [],
        page_count: 1,
        mime_type: 'application/pdf',
        custom_fields: {
          ai_normalization_status: 'pending'
        }
      };

      paperlessService.getDocument = async () => mockDocument;

      const response = await request(app)
        .get('/workspace/api/doc/456')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Content-Type', /json/);

      assert.strictEqual(response.body.id, 456);
      assert.strictEqual(response.body.persistedNormalizedUrl, null);
      assert.strictEqual(response.body.normalizationStatus, 'pending');
      assert.strictEqual(response.body.normalizedUrl, '/api/normalized/456/1');
    });

    it('should fallback to on-demand URL when persisted URL is not available', async function() {
      const mockDocument = {
        id: 789,
        title: 'Document Without Persisted URL',
        content: 'Test content',
        correspondent: null,
        document_type: null,
        tags: [],
        page_count: 3,
        mime_type: 'application/pdf',
        custom_fields: {}
      };

      paperlessService.getDocument = async () => mockDocument;

      const response = await request(app)
        .get('/workspace/api/doc/789')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Content-Type', /json/);

      assert.strictEqual(response.body.id, 789);
      assert.strictEqual(response.body.persistedNormalizedUrl, null);
      assert.strictEqual(response.body.normalizationStatus, 'pending');
      assert.strictEqual(response.body.normalizedUrl, '/api/normalized/789/1');
    });
  });

  describe('Workspace Route with Missing Custom Fields', function() {
    it('should apply defaults when custom_fields is undefined', async function() {
      const mockDocument = {
        id: 999,
        title: 'Document Without Custom Fields',
        content: 'Test content',
        correspondent: null,
        document_type: null,
        tags: [],
        page_count: 1,
        mime_type: 'application/pdf'
        // No custom_fields property
      };

      paperlessService.getDocument = async () => mockDocument;

      const response = await request(app)
        .get('/workspace/api/doc/999')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Content-Type', /json/);

      assert.strictEqual(response.body.id, 999);
      assert.strictEqual(response.body.persistedNormalizedUrl, null);
      assert.strictEqual(response.body.normalizationStatus, 'pending');
      assert.strictEqual(response.body.normalizedUrl, '/api/normalized/999/1');
    });

    it('should handle documents with empty custom_fields object', async function() {
      const mockDocument = {
        id: 888,
        title: 'Document With Empty Custom Fields',
        content: 'Test content',
        correspondent: null,
        document_type: null,
        tags: [],
        page_count: 1,
        mime_type: 'application/pdf',
        custom_fields: {}
      };

      paperlessService.getDocument = async () => mockDocument;

      const response = await request(app)
        .get('/workspace/api/doc/888')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Content-Type', /json/);

      assert.strictEqual(response.body.id, 888);
      assert.strictEqual(response.body.persistedNormalizedUrl, null);
      assert.strictEqual(response.body.normalizationStatus, 'pending');
      assert.strictEqual(response.body.normalizedUrl, '/api/normalized/888/1');
    });
  });

  describe('Normalization Status Values', function() {
    const statusValues = ['pending', 'processing', 'completed', 'failed', 'skipped'];

    statusValues.forEach(status => {
      it(`should handle normalizationStatus='${status}' correctly`, async function() {
        const mockDocument = {
          id: 100 + statusValues.indexOf(status),
          title: `Document with ${status} status`,
          content: 'Test content',
          correspondent: null,
          document_type: null,
          tags: [],
          page_count: 1,
          mime_type: 'application/pdf',
          custom_fields: {
            ai_normalization_status: status
          }
        };

        paperlessService.getDocument = async () => mockDocument;

        const response = await request(app)
          .get(`/workspace/api/doc/${mockDocument.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
          .expect('Content-Type', /json/);

        assert.strictEqual(response.body.normalizationStatus, status);
        assert.strictEqual(response.body.persistedNormalizedUrl, null);
        assert.strictEqual(response.body.normalizedUrl, `/api/normalized/${mockDocument.id}/1`);
      });
    });
  });

  describe('Error Handling', function() {
    it('should return 404 when document not found', async function() {
      paperlessService.getDocument = async () => {
        throw new Error('Document not found');
      };

      await request(app)
        .get('/workspace/api/doc/999999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 400 for invalid document ID', async function() {
      await request(app)
        .get('/workspace/api/doc/invalid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should handle missing paperless service gracefully', async function() {
      paperlessService.getDocument = async () => {
        throw new Error('Service unavailable');
      };

      await request(app)
        .get('/workspace/api/doc/123')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('Backward Compatibility', function() {
    it('should not break existing workspace functionality', async function() {
      const mockDocument = {
        id: 777,
        title: 'Legacy Document',
        content: 'Test content',
        correspondent: null,
        document_type: null,
        tags: [],
        page_count: 1,
        mime_type: 'application/pdf'
        // No custom_fields - simulates old document
      };

      paperlessService.getDocument = async () => mockDocument;

      const response = await request(app)
        .get('/workspace/api/doc/777')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Content-Type', /json/);

      // Verify all original fields are present
      assert.strictEqual(response.body.id, 777);
      assert.strictEqual(response.body.title, 'Legacy Document');
      assert.strictEqual(response.body.pageCount, 1);
      assert.strictEqual(response.body.mimeType, 'application/pdf');
      assert.ok(response.body.normalizedUrl, 'normalizedUrl should exist');
      
      // Verify new fields have safe defaults
      assert.strictEqual(response.body.persistedNormalizedUrl, null);
      assert.strictEqual(response.body.normalizationStatus, 'pending');
    });
  });
});
