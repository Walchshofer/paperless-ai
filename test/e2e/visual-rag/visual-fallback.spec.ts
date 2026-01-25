import { test, expect } from '@playwright/test';

// NOTE: This test requires test-agent infra to support route mocking for the visual search endpoint.

test.describe('Visual-RAG fallback behavior', () => {
  test('shows fallback banner and triggers text fallback when visual search returns 503', async ({ page }) => {
    await page.goto('/rag');

    // If RAG UI not available (route disabled), skip in this environment
    const overlayAnchor = await page.$('[data-testid="overlay-viewer-island"]');
    if (!overlayAnchor) {
      test.skip(true, 'RAG UI not available in this environment (skipping)');
      return;
    }

    // Wait for send button to be available
    await page.waitForSelector('[data-testid="rag-send-button"]', { timeout: 10000 });

    // Mock the visual search endpoint to return 503
    await page.route('**/api/visual-rag/search/visual', route => {
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Service unavailable' }) });
    });

    // Spy on the text search endpoint to assert it was called
    let ragCalled = false;
    await page.route('**/api/rag/search', async (route) => {
      ragCalled = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: [] }) });
    });

    // Trigger a visual-search-requested event in the page (after listener attached)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('visual-search-requested', { detail: { imageBase64: 'ZmFrZQ==', documentId: 123 } }));
    });

    // Wait for banner to appear
    await page.waitForSelector('[data-testid="visual-503-banner"]', { state: 'visible', timeout: 15000 });

    expect(await page.isVisible('[data-testid="visual-503-banner"]')).toBe(true);
    expect(ragCalled).toBe(true);
  });
});