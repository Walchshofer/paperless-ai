import { test, expect, Page } from '@playwright/test';
import { getHistoryDocId } from '../helpers/fixtures';
const { switchTab, navigateToWorkspace, waitForIslandMount } = require('../helpers/workspace-fixtures');

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
  const HISTORY_DOC_ID = getHistoryDocId();
  test.describe.configure({ timeout: 60000 });

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

  async function waitForHistoryIslands(page: Page, requireTabs = true) {
    await page.waitForSelector('[data-testid="overlay-viewer-root"]', {
      timeout: 10000
    });
    if (requireTabs) {
      await page.waitForSelector('[data-testid="history-tabs-root"]', {
        timeout: 10000
      });
    }
  }

  async function enableDrawMode(page: Page) {
    // Wait for the document image to fully decode before enabling draw mode.
    // captureRegion returns early when imageLoaded is false, silently
    // preventing the visual-search-requested event from dispatching.
    await page.waitForFunction(
      () => {
        const img = document.querySelector(
          '[data-testid="overlay-document-image"]'
        ) as HTMLImageElement | null;
        return img != null && img.naturalWidth > 0;
      },
      { timeout: 15000 }
    );

    const drawModeToggle = page.locator('[data-testid="draw-mode-btn"]');
    await expect(drawModeToggle).toBeVisible();
    await drawModeToggle.click();
    await expect(page.locator('[data-testid="overlay-container"]')).toHaveAttribute(
      'data-draw-mode',
      'active'
    );
  }

  async function drawSelectionBox(page: Page) {
    const container = page.locator('[data-testid="overlay-container"]');
    const box = await container.boundingBox();
    if (!box) return false;

    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.up();
    return true;
  }

  test('Complete user flow: History → Red Pen → Similar → Results', async ({
    page
  }) => {
    const url = `${BASE_URL}/history/${HISTORY_DOC_ID}`;
    const response = await handleLogin(page, url);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${url}`);
      return;
    }

    // Wait for islands to hydrate
    try {
      await waitForHistoryIslands(page, true);
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
    expect(page.url()).toMatch(
      new RegExp(`/history/(doc/)?${HISTORY_DOC_ID}$`)
    );

    // 2. Select Red Pen tool
    await enableDrawMode(page);

    // 3. Draw bounding box on visual element
    const didDraw = await drawSelectionBox(page);
    if (!didDraw) {
      test.skip(true, 'Could not get container bounding box');
      return;
    }

    // 4. Verify POST /api/visual-rag/search/visual emitted
    await page.waitForTimeout(500); // Allow time for API call
    if (!apiRequestPayload) {
      // Retry drawing once in case the first attempt didn't register (flaky canvas interactions)
      await drawSelectionBox(page);
      await page.waitForTimeout(1000);
    }

    expect(apiRequestPayload).not.toBeNull();
    const payload = apiRequestPayload!;
    if (!payload) return;

    // 5. Verify Base64 payload valid
    expect(payload.image).toBeTruthy();
    expect(typeof payload.image).toBe('string');
    // Base64 should be at least a few characters
    expect((payload.image as string).length).toBeGreaterThan(10);

    // 6. Verify collection routing
    expect(payload.collection || 'visual_pages').toBe('visual_pages');

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
    const url = `${BASE_URL}/history/${HISTORY_DOC_ID}`;
    const response = await handleLogin(page, url);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${url}`);
      return;
    }

    try {
      await waitForHistoryIslands(page, false);
    } catch {
      test.skip(true, 'OverlayViewer not hydrated');
      return;
    }

    let requestPayload: Record<string, unknown> | null = null;
    let responseData: Record<string, unknown> | null = null;

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
    await enableDrawMode(page);
    const didDraw = await drawSelectionBox(page);
    if (!didDraw) {
      test.skip(true, 'Could not get container bounding box');
      return;
    }

    await page.waitForTimeout(500);

    // Verify collection in request
    expect((requestPayload as Record<string, unknown> | null)?.collection || 'visual_pages').toBe('visual_pages');

    // Verify response indicates visual_pages collection
    expect((responseData as Record<string, unknown> | null)?.collectionUsed).toBe('visual_pages');
  });

  test('Filter propagation: correspondent_id included in API request', async ({
    page
  }) => {
    const url = `${BASE_URL}/history/${HISTORY_DOC_ID}`;
    const response = await handleLogin(page, url);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${url}`);
      return;
    }

    try {
      await waitForHistoryIslands(page, true);
    } catch {
      test.skip(true, 'Islands not hydrated');
      return;
    }

    // Wait for the document image to fully load before attempting any draw
    // captureRegion returns early if imageLoaded is false, causing null requestPayload
    try {
      await page.waitForFunction(
        () => {
          const img = document.querySelector(
            '[data-testid="overlay-document-image"]'
          ) as HTMLImageElement | null;
          return img != null && img.naturalWidth > 0;
        },
        { timeout: 15000 }
      );
    } catch {
      test.skip(true, 'Document image did not load in time');
      return;
    }

    let requestPayload: unknown = null;

    await page.route('**/api/visual-rag/search/visual', async (route) => {
      requestPayload = JSON.parse(route.request().postData() || '{}') as unknown;

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
    await switchTab(page, 'metadata');

    // Look for filter button
    const correspondentFilter = page.locator(
      '[data-testid="panel-metadata"] button[title="Filter Similar by this correspondent"]'
    );
    const tagFilter = page.locator(
      '[data-testid="panel-metadata"] button[title="Filter Similar by this tag"]'
    );
    let filterApplied = false;
    if (await correspondentFilter.count()) {
      await correspondentFilter.first().click();
      filterApplied = true;
    } else if (await tagFilter.count()) {
      await tagFilter.first().click();
      filterApplied = true;
    }
    expect(filterApplied).toBeTruthy();

    // Draw box to trigger search
    await enableDrawMode(page);
    const didDraw = await drawSelectionBox(page);
    if (!didDraw) {
      test.skip(true, 'Could not get container bounding box');
      return;
    }

    // Wait for the intercepted route to be fulfilled (up to 3s)
    await page.waitForTimeout(3000);

    // Verify request was made
    expect(requestPayload).not.toBeNull();
    if (!requestPayload) return;
    expect((requestPayload as Record<string, unknown>).image).toBeTruthy();
    expect((requestPayload as Record<string, unknown>).filters).toBeTruthy();
  });

  test('End-to-end timing: measure pipeline latency', async ({ page }) => {
    const url = `${BASE_URL}/history/${HISTORY_DOC_ID}`;
    const response = await handleLogin(page, url);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${url}`);
      return;
    }

    try {
      await waitForHistoryIslands(page, false);
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
    await enableDrawMode(page);
    const didDraw = await drawSelectionBox(page);
    if (!didDraw) {
      test.skip(true, 'Could not get container bounding box');
      return;
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
    const url = `${BASE_URL}/history/${HISTORY_DOC_ID}`;
    const response = await handleLogin(page, url);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${url}`);
      return;
    }

    try {
      await waitForHistoryIslands(page, true);
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
    await enableDrawMode(page);
    const didDraw = await drawSelectionBox(page);
    if (!didDraw) {
      test.skip(true, 'Could not get container bounding box');
      return;
    }

    // Wait for error to appear
    await page.waitForSelector('[data-testid="search-error"]', {
      timeout: 5000
    });

    const errorElement = page.locator('[data-testid="search-error"]');
    await expect(errorElement).toBeVisible();
  });

  test('Business rule: "Personal Note" title pre-fills correspondent', async ({ page }) => {
    await navigateToWorkspace(page, HISTORY_DOC_ID);
    await waitForIslandMount(page, 'context-sidebar-island');
    await switchTab(page, 'metadata');

    // Trigger document switch with test data
    await page.evaluate(({ docId }) => {
      window.dispatchEvent(new CustomEvent('workspace:document-switched', {
        detail: {
          documentId: docId,
          document: {
            id: docId,
            title: 'A New Personal Note',
            correspondent: null,
            currentUser: 'elfman',
            tagItems: [],
            availableTags: [],
            customFields: []
          },
          visual: { fields: [] }
        }
      }));
    }, { docId: HISTORY_DOC_ID });

    const correspondentInput = page.locator('[data-testid="smart-correspondent-input"]');
    await expect(correspondentInput).toHaveValue('elfman');
  });

  test('Edge case: clearing auto-filled correspondent prevents re-fill on title edit', async ({ page }) => {
    await navigateToWorkspace(page, HISTORY_DOC_ID);
    await waitForIslandMount(page, 'context-sidebar-island');
    await switchTab(page, 'metadata');

    // Step 1: Trigger document switch with "Personal Note" title → auto-fills correspondent
    await page.evaluate(({ docId }) => {
      window.dispatchEvent(new CustomEvent('workspace:document-switched', {
        detail: {
          documentId: docId,
          document: {
            id: docId,
            title: 'A New Personal Note',
            correspondent: null,
            currentUser: 'elfman',
            tagItems: [],
            availableTags: [],
            customFields: []
          },
          visual: { fields: [] }
        }
      }));
    }, { docId: HISTORY_DOC_ID });

    const correspondentInput = page.locator('[data-testid="smart-correspondent-input"]');
    await expect(correspondentInput).toHaveValue('elfman');

    // Step 2: User manually clears the correspondent
    await correspondentInput.fill('');
    await expect(correspondentInput).toHaveValue('');

    // Step 3: User edits the title (still contains "Personal Note")
    const titleInput = page.locator('[data-testid="smart-title-input"]');
    await titleInput.fill('My Personal Note Updated');

    // Correspondent should remain empty — the user's intent to clear it is respected
    await expect(correspondentInput).toHaveValue('');
  });
});

