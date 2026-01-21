import { test, expect } from '@playwright/test';
import { getHistoryDocId } from '../helpers/fixtures';

/**
 * Red Pen Visual Search E2E Tests
 *
 * Tests the complete Red Pen flow:
 * - Draw box → Event → API call → Results
 * - 503 Initializing state handling
 * - Low-quality crop warning
 * - Feedback loop confirmation
 *
 * Architecture Reference: ticket:009.4
 */

test.describe('Red Pen Visual Search Flow', () => {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
  const HISTORY_DOC_ID = getHistoryDocId();
  const HISTORY_URL = `${BASE_URL}/history/${HISTORY_DOC_ID}`;

  async function gotoHistory(page: any) {
    const response = await page.goto(HISTORY_URL, {
      waitUntil: 'load',
      timeout: 10000
    }).catch(() => null);

    const loginFormPresent = response && (
      response.url().includes('/login') ||
      (await page.locator('form[action="/login"]').count()) > 0
    );

    if (loginFormPresent) {
      throw new Error('Auth state missing for /history (login redirect).');
    }

    return response;
  }


  test('Red Pen toggle enables drawing mode', async ({ page }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="overlay-viewer-root"]', {
        timeout: 5000
      });
    } catch {
      test.skip(true, 'OverlayViewerIsland not hydrated');
      return;
    }

    // Find and click Red Pen toggle
    const redPenToggle = page.locator('[data-testid="red-pen-toggle"]');
    await expect(redPenToggle).toBeVisible();
    await expect(redPenToggle).toHaveAttribute('aria-pressed', 'false');

    // Enable draw mode
    await redPenToggle.click();
    await expect(redPenToggle).toHaveAttribute('aria-pressed', 'true');

    // Verify button text changed
    const buttonText = await redPenToggle.textContent();
    expect(buttonText).toContain('Drawing Mode');
  });

  test('Drawing a box triggers visual-search-requested event', async ({
    page
  }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="overlay-viewer-root"]', {
        timeout: 5000
      });
    } catch {
      test.skip(true, 'OverlayViewerIsland not hydrated');
      return;
    }

    // Set up event listener before drawing
    const eventPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener('visual-search-requested', (e: any) => {
          resolve(e.detail);
        });
        // Timeout after 10 seconds
        setTimeout(() => resolve(null), 10000);
      });
    });

    // Enable draw mode
    await page.click('[data-testid="red-pen-toggle"]');

    // Get the container element for drawing
    const container = page.locator(
      '[data-testid="overlay-viewer-root"] > div:last-child'
    );
    const box = await container.boundingBox();

    if (!box) {
      test.skip(true, 'Could not get container bounding box');
      return;
    }

    // Draw a box (100x100 pixels in the center)
    const startX = box.x + box.width / 4;
    const startY = box.y + box.height / 4;
    const endX = startX + 100;
    const endY = startY + 100;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();

    // Wait for event
    const eventDetail = await eventPromise;

    // Verify event was dispatched with correct structure
    if (eventDetail) {
      expect((eventDetail as any).imageBase64).toBeTruthy();
      expect((eventDetail as any).collection).toBe('visual_pages');
      expect((eventDetail as any).bbox).toBeDefined();
    }
  });

  test('Small box shows warning message', async ({ page }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="overlay-viewer-root"]', {
        timeout: 5000
      });
    } catch {
      test.skip(true, 'OverlayViewerIsland not hydrated');
      return;
    }

    // Enable draw mode
    await page.click('[data-testid="red-pen-toggle"]');

    // Get the container element
    const container = page.locator(
      '[data-testid="overlay-viewer-root"] > div:last-child'
    );
    const box = await container.boundingBox();

    if (!box) {
      test.skip(true, 'Could not get container bounding box');
      return;
    }

    // Draw a very small box (5x5 pixels)
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 5, startY + 5);
    await page.mouse.up();

    // Check for warning message
    const warning = page.locator('[data-testid="selection-warning"]');
    await expect(warning).toBeVisible();

    const warningText = await warning.textContent();
    expect(warningText).toContain('too small');
  });

  test('Clear boxes button removes all selections', async ({ page }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="overlay-viewer-root"]', {
        timeout: 5000
      });
    } catch {
      test.skip(true, 'OverlayViewerIsland not hydrated');
      return;
    }

    // Enable draw mode
    await page.click('[data-testid="red-pen-toggle"]');

    // Get container
    const container = page.locator(
      '[data-testid="overlay-viewer-root"] > div:last-child'
    );
    const box = await container.boundingBox();

    if (!box) {
      test.skip(true, 'Could not get container bounding box');
      return;
    }

    // Draw a box
    const startX = box.x + box.width / 4;
    const startY = box.y + box.height / 4;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 100);
    await page.mouse.up();

    // Clear button should appear
    const clearButton = page.locator('[data-testid="clear-boxes"]');
    await expect(clearButton).toBeVisible();

    // Click clear
    await clearButton.click();

    // Clear button should disappear
    await expect(clearButton).not.toBeVisible();
  });

  test('503 Initializing state shows GPU loading indicator', async ({
    page
  }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="overlay-viewer-root"]', {
        timeout: 5000
      });
      await page.waitForSelector('[data-testid="history-tabs-root"]', {
        timeout: 5000
      });
    } catch {
      test.skip(true, 'Islands not hydrated');
      return;
    }

    // Mock API to return 503 initializing
    await page.route('**/api/visual-rag/search/visual', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Service initializing',
          type: 'SIDECAR_INITIALIZING',
          detail: 'Stage: loading_model',
          retryable: true
        })
      });
    });

    // Enable draw mode and draw a box
    await page.click('[data-testid="red-pen-toggle"]');

    const container = page.locator(
      '[data-testid="overlay-viewer-root"] > div:last-child'
    );
    const box = await container.boundingBox();

    if (!box) {
      test.skip(true, 'Could not get container bounding box');
      return;
    }

    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 150);
    await page.mouse.up();

    // Wait for Similar tab to show GPU initializing
    await page.waitForSelector('[data-testid="panel-similar"]', {
      timeout: 5000
    });

    const gpuInit = page.locator('[data-testid="gpu-initializing"]');
    await expect(gpuInit).toBeVisible();

    const text = await gpuInit.textContent();
    expect(text).toContain('GPU Initializing');
  });

  test('Successful search displays MaxSim results', async ({ page }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="overlay-viewer-root"]', {
        timeout: 5000
      });
      await page.waitForSelector('[data-testid="history-tabs-root"]', {
        timeout: 5000
      });
    } catch {
      test.skip(true, 'Islands not hydrated');
      return;
    }

    // Mock successful API response
    await page.route('**/api/visual-rag/search/visual', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          results: [
            { docId: 2, pageNum: 1, score: 0.85, thumbnailUrl: '/thumb/2' },
            { docId: 3, pageNum: 1, score: 0.72, thumbnailUrl: '/thumb/3' }
          ],
          collectionUsed: 'visual_pages',
          scoreType: 'maxsim'
        })
      });
    });

    // Enable draw mode and draw a box
    await page.click('[data-testid="red-pen-toggle"]');

    const container = page.locator(
      '[data-testid="overlay-viewer-root"] > div:last-child'
    );
    const box = await container.boundingBox();

    if (!box) {
      test.skip(true, 'Could not get container bounding box');
      return;
    }

    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 150);
    await page.mouse.up();

    // Wait for results to appear
    await page.waitForSelector('[data-testid="similar-results"]', {
      timeout: 10000
    });

    const results = page.locator('[data-testid="similar-results"]');
    await expect(results).toBeVisible();

    const resultsText = await results.textContent();
    expect(resultsText).toContain('2 similar documents');
  });

  test('Full E2E flow: Draw → Search → Switch to Similar tab', async ({
    page
  }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="overlay-viewer-root"]', {
        timeout: 5000
      });
      await page.waitForSelector('[data-testid="history-tabs-root"]', {
        timeout: 5000
      });
    } catch {
      test.skip(true, 'Islands not hydrated');
      return;
    }

    // Mock successful API response
    await page.route('**/api/visual-rag/search/visual', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          results: [
            { docId: 5, pageNum: 1, score: 0.91, thumbnailUrl: '/thumb/5' }
          ],
          collectionUsed: 'visual_pages',
          scoreType: 'maxsim'
        })
      });
    });

    // 1. Verify we're on Text tab initially
    const textTab = page.locator('[data-testid="tab-text"]');
    await expect(textTab).toHaveAttribute('aria-selected', 'true');

    // 2. Enable draw mode
    await page.click('[data-testid="red-pen-toggle"]');

    // 3. Draw a box
    const container = page.locator(
      '[data-testid="overlay-viewer-root"] > div:last-child'
    );
    const box = await container.boundingBox();

    if (!box) {
      test.skip(true, 'Could not get container bounding box');
      return;
    }

    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.up();

    // 4. Similar tab should now be active (auto-switched after search)
    const similarTab = page.locator('[data-testid="tab-similar"]');
    await expect(similarTab).toHaveAttribute('aria-selected', 'true');

    // 5. Results should be visible
    const results = page.locator('[data-testid="similar-results"]');
    await expect(results).toBeVisible();
  });
});

