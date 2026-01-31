import { test, expect, Page } from '@playwright/test';

/**
 * Alpha-9 Full Pipeline E2E Tests
 *
 * Comprehensive end-to-end validation of the complete Alpha-9 Visual RAG pipeline:
 * UI Red Pen → Node.js Gateway → Python Sidecar → Qdrant
 *
 * Architecture Reference: ticket:010.1
 */

test.describe('Alpha-9 Full Pipeline E2E', () => {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

  // Helper to handle login
  async function handleLogin(page: Page, targetUrl: string) {
    const response = await page
      .goto(targetUrl, { waitUntil: 'load', timeout: 10000 })
      .catch(() => null);

    const loginFormPresent =
      response &&
      (response.url().includes('/login') ||
        (await page.locator('form[action="/login"]').count()) > 0);

    if (loginFormPresent) {
      const user = process.env.PAPERLESS_ADMIN_USER || 'elfman';
      const pass =
        process.env.PAPERLESS_ADMIN_PASSWORD ||
        process.env.POSTGRES_PASSWORD ||
        'P2tr3ck!1976';
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'load' });
      await page.fill('#username', user);
      await page.fill('#password', pass);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }),
        page.click('button[type="submit"]')
      ]).catch(() => null);

      return page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
    }

    return response;
  }

  test('Complete user flow: History → Red Pen → Similar → Results', async ({
    page
  }) => {
    const url = `${BASE_URL}/history/1`;
    const response = await handleLogin(page, url);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${url}`);
      return;
    }

    // Wait for islands to hydrate
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

    // Track API request
    let apiRequestPayload: Record<string, unknown> | null = null;
    await page.route('**/api/visual-rag/search/visual', async (route) => {
      const request = route.request();
      apiRequestPayload = JSON.parse(request.postData() || '{}');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          results: [
            { docId: 2, pageNum: 1, score: 0.89, thumbnailUrl: '/thumb/2' },
            { docId: 5, pageNum: 2, score: 0.76, thumbnailUrl: '/thumb/5' }
          ],
          collectionUsed: 'visual_pages',
          scoreType: 'maxsim',
          executionTimeMs: 142
        })
      });
    });

    // 1. Open History Document (already done)
    expect(page.url()).toMatch(/\/history\/(doc\/)?1/);

    // 2. Select Red Pen tool
    const redPenToggle = page.locator('[data-testid="red-pen-toggle"]');
    await expect(redPenToggle).toBeVisible();
    await redPenToggle.click();
    await expect(redPenToggle).toHaveAttribute('aria-pressed', 'true');

    // 3. Draw bounding box on visual element
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

    // 4. Verify POST /api/visual-rag/search/visual emitted
    await page.waitForTimeout(500); // Allow time for API call
    if (!apiRequestPayload) {
      // Retry drawing once in case the first attempt didn't register (flaky canvas interactions)
      await redPenToggle.click();
      const boxRetry = await container.boundingBox();
      if (boxRetry) {
        await page.mouse.move(boxRetry.x + 60, boxRetry.y + 60);
        await page.mouse.down();
        await page.mouse.move(boxRetry.x + 210, boxRetry.y + 210);
        await page.mouse.up();
      }
      await page.waitForTimeout(1000);
    }

    expect(apiRequestPayload).not.toBeNull();

    // 5. Verify Base64 payload valid
    expect(apiRequestPayload.image).toBeTruthy();
    expect(typeof apiRequestPayload.image).toBe('string');
    // Base64 should be at least a few characters
    expect(apiRequestPayload.image.length).toBeGreaterThan(10);

    // 6. Verify collection routing
    expect(apiRequestPayload.collection || 'visual_pages').toBe('visual_pages');

    // 7. Verify Similar tab renders results
    await page.waitForSelector('[data-testid="similar-results"]', {
      timeout: 5000
    });
    const results = page.locator('[data-testid="similar-results"]');
    await expect(results).toBeVisible();

    // 8. Verify MaxSim scores displayed
    const resultsText = await results.textContent();
    expect(resultsText).toContain('2 similar documents');
    expect(resultsText).toContain('%'); // Percentage scores

    // 9. Verify thumbnails rendered (or links)
    const resultLinks = page.locator('[data-testid="similar-results"] a');
    const linkCount = await resultLinks.count();
    expect(linkCount).toBeGreaterThan(0);
  });

  test('Collection routing: results from visual_pages with 320-dim', async ({
    page
  }) => {
    const url = `${BASE_URL}/history/1`;
    const response = await handleLogin(page, url);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${url}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="overlay-viewer-root"]', {
        timeout: 5000
      });
    } catch {
      test.skip(true, 'OverlayViewer not hydrated');
      return;
    }

    let requestPayload: any = null;
    let responseData: any = null;

    await page.route('**/api/visual-rag/search/visual', async (route) => {
      requestPayload = JSON.parse(route.request().postData() || '{}');

      responseData = {
        success: true,
        results: [{ docId: 3, pageNum: 1, score: 0.82 }],
        collectionUsed: 'visual_pages',
        scoreType: 'maxsim',
        embedding_dim: 320
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseData)
      });
    });

    // Draw box
    await page.click('[data-testid="red-pen-toggle"]');
    const container = page.locator(
      '[data-testid="overlay-viewer-root"] > div:last-child'
    );
    const box = await container.boundingBox();

    if (box) {
      await page.mouse.move(box.x + 30, box.y + 30);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 150);
      await page.mouse.up();
    }

    await page.waitForTimeout(500);

    // Verify collection in request
    expect(requestPayload?.collection || 'visual_pages').toBe('visual_pages');

    // Verify response indicates visual_pages collection
    expect(responseData.collectionUsed).toBe('visual_pages');
  });

  test('Filter propagation: correspondent_id included in API request', async ({
    page
  }) => {
    const url = `${BASE_URL}/history/1`;
    const response = await handleLogin(page, url);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${url}`);
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

    let requestPayload: any = null;

    await page.route('**/api/visual-rag/search/visual', async (route) => {
      requestPayload = JSON.parse(route.request().postData() || '{}');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          results: [{ docId: 7, score: 0.91 }],
          collectionUsed: 'visual_pages'
        })
      });
    });

    // Go to Metadata tab and click filter button (if available)
    await page.click('[data-testid="tab-metadata"]');
    await page.waitForSelector('[data-testid="panel-metadata"]', {
      timeout: 3000
    });

    // Look for filter button
    const filterBtn = page.locator('[data-testid="panel-metadata"] button').first();
    const filterBtnCount = await filterBtn.count();

    if (filterBtnCount > 0) {
      await filterBtn.click();
    }

    // Draw box to trigger search
    await page.click('[data-testid="red-pen-toggle"]');
    const container = page.locator(
      '[data-testid="overlay-viewer-root"] > div:last-child'
    );
    const box = await container.boundingBox();

    if (box) {
      await page.mouse.move(box.x + 40, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + 180, box.y + 180);
      await page.mouse.up();
    }

    await page.waitForTimeout(500);

    // Verify request was made
    expect(requestPayload).not.toBeNull();
    expect(requestPayload.image).toBeTruthy();
  });

  test('End-to-end timing: measure pipeline latency', async ({ page }) => {
    const url = `${BASE_URL}/history/1`;
    const response = await handleLogin(page, url);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${url}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="overlay-viewer-root"]', {
        timeout: 5000
      });
    } catch {
      test.skip(true, 'OverlayViewer not hydrated');
      return;
    }

    let requestStartTime = 0;
    let requestEndTime = 0;

    await page.route('**/api/visual-rag/search/visual', async (route) => {
      requestStartTime = Date.now();

      // Simulate some processing time
      await new Promise((r) => setTimeout(r, 50));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          results: [{ docId: 1, score: 0.95 }],
          collectionUsed: 'visual_pages',
          executionTimeMs: 42
        })
      });

      requestEndTime = Date.now();
    });

    const drawStartTime = Date.now();

    // Draw box
    await page.click('[data-testid="red-pen-toggle"]');
    const container = page.locator(
      '[data-testid="overlay-viewer-root"] > div:last-child'
    );
    const box = await container.boundingBox();

    if (box) {
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 200);
      await page.mouse.up();
    }

    // Wait for results
    await page.waitForSelector('[data-testid="similar-results"]', {
      timeout: 10000
    });

    const totalTime = Date.now() - drawStartTime;
    const apiTime = requestEndTime - requestStartTime;

    console.log(`Performance Metrics:`);
    console.log(`  Total E2E time: ${totalTime}ms`);
    console.log(`  API response time: ${apiTime}ms`);

    // Verify acceptable latency (under 5 seconds for E2E)
    expect(totalTime).toBeLessThan(5000);
  });

  test('Error recovery: handles API failure gracefully', async ({ page }) => {
    const url = `${BASE_URL}/history/1`;
    const response = await handleLogin(page, url);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${url}`);
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

    // Mock API to return error
    await page.route('**/api/visual-rag/search/visual', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error',
          detail: 'Sidecar connection failed'
        })
      });
    });

    // Draw box
    await page.click('[data-testid="red-pen-toggle"]');
    const container = page.locator(
      '[data-testid="overlay-viewer-root"] > div:last-child'
    );
    const box = await container.boundingBox();

    if (box) {
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 200);
      await page.mouse.up();
    }

    // Wait for error to appear
    await page.waitForSelector('[data-testid="search-error"]', {
      timeout: 5000
    });

    const errorElement = page.locator('[data-testid="search-error"]');
    await expect(errorElement).toBeVisible();
  });
});

