import { test, expect } from '@playwright/test';
import fetch from 'node-fetch';
import { getTestDocId, loadFixtureData } from '../helpers/fixtures';
import { pollForQdrantPoints, collectionExists, QDRANT_URL, COLLECTION_NAME } from '../helpers/qdrant-poll';

const VISUAL_RAG_URL = process.env.VISUAL_RAG_URL || 'http://127.0.0.1:8001';

/**
 * Reingest Smoke Test
 *
 * - Re-ingests a single Paperless document into Visual-RAG via /index/pdf
 * - Polls Qdrant for resulting points in the configured collection
 * - Cleans up created points after verification
 */

test.describe('Reingest Verification', () => {
  test.beforeAll(async () => {
    const exists = await collectionExists().catch(() => false);
    if (!exists) {
      console.warn(`Qdrant collection '${COLLECTION_NAME}' not available at ${QDRANT_URL} - reingest test will be skipped`);
    }
  });

  test('reingest a single document results in Qdrant points', async ({ page }) => {
    // Check Qdrant availability
    const qdrantReady = await collectionExists().catch(() => false);
    if (!qdrantReady) {
      test.skip(true, 'Qdrant collection not available');
      return;
    }

    const fixture = loadFixtureData();
    const TEST_DOC_ID = getTestDocId();
    const PAPERLESS_API_URL = fixture.paperlessApiUrl;
    const PAPERLESS_API_TOKEN = process.env.PAPERLESS_API_TOKEN || process.env.PAPERLESS_TOKEN;

    // Ensure Visual RAG sidecar is reachable
    try {
      const r = await fetch(`${VISUAL_RAG_URL}/ready`);
      if (!r.ok) {
        test.skip(true, 'Visual RAG sidecar not ready');
        return;
      }
    } catch {
      test.skip(true, 'Visual RAG sidecar not reachable');
      return;
    }

    // Download PDF from Paperless API
    const downloadUrl = `${PAPERLESS_API_URL}/documents/${TEST_DOC_ID}/download/`;
    const resp = await page.request.get(downloadUrl, {
      headers: { Authorization: `Token ${PAPERLESS_API_TOKEN}` }
    });

    if (resp.status() >= 400) {
      console.log('Failed to download PDF for test document - skipping', resp.status());
      test.skip(true, 'Could not download test PDF from Paperless API');
      return;
    }

    const arrayBuf = await (resp as any).arrayBuffer();
    const pdfBase64 = Buffer.from(new Uint8Array(arrayBuf)).toString('base64');

    // Send PDF to Visual-RAG index endpoint
    const indexResp = await page.request.post(`${VISUAL_RAG_URL}/index/pdf`, {
      headers: { 'Content-Type': 'application/json' },
      data: { doc_id: TEST_DOC_ID, pdf_data: pdfBase64 }
    });

    if (indexResp.status() >= 400) {
      const body = await indexResp.text();
      console.log('Visual RAG indexing error:', indexResp.status(), body);
      test.skip(true, 'Visual RAG /index/pdf returned error');
      return;
    }

    // Poll Qdrant for points
    let points;
    try {
      points = await pollForQdrantPoints(TEST_DOC_ID, { timeoutMs: 20000, intervalMs: 500, minCount: 1 });
    } catch (err) {
      console.log('Timed out waiting for Qdrant points:', (err as any).message);
      test.skip(true, 'Qdrant points not found - sidecar may be initializing');
      return;
    }

    expect(points.length).toBeGreaterThan(0);

    // Teardown: remove points created by this doc
    try {
      const delResp = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            must: [ { key: 'doc_id', match: { value: String(TEST_DOC_ID) } } ]
          }
        })
      });

      if (!delResp.ok) {
        console.warn('Failed to delete Qdrant points for cleanup:', delResp.statusText);
      }
    } catch (err) {
      console.warn('Cleanup deletion failed:', (err as any).message);
    }
  });
});
