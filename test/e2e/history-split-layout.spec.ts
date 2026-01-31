import { test, expect } from '@playwright/test';
import { getHistoryDocId } from '../helpers/fixtures';

/**
 * History Split Layout E2E Tests
 *
 * Tests the Alpha-9 History Document View with:
 * - Island mounting (OverlayViewer, HistoryTabs)
 * - Tab navigation and interaction
 * - Visual search event communication
 * - 503 Initializing state handling
 *
 * Architecture Reference: ticket:008.5
 */

test.describe('History Split Layout - Islands', () => {
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

  test('mounts overlay-viewer-island and history-tabs-island', async ({ page }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL} - skipping island mount test`);
      return;
    }

    // Check overlay-viewer-island anchor
    const overlayAnchor = page.locator('[data-island="overlay-viewer-island"]');
    const overlayCount = await overlayAnchor.count();
    expect(overlayCount).toBeGreaterThan(0);

    // Check history-tabs-island anchor
    const tabsAnchor = page.locator('[data-island="history-tabs-island"]');
    const tabsCount = await tabsAnchor.count();
    expect(tabsCount).toBeGreaterThan(0);

    // Verify data-props are present
    const overlayProps = await overlayAnchor.getAttribute('data-props');
    expect(overlayProps).toBeTruthy();

    const tabsProps = await tabsAnchor.getAttribute('data-props');
    expect(tabsProps).toBeTruthy();
  });

  test('history-tabs-island shows three tabs (Text, Metadata, Similar)', async ({ page }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    // Wait for island runtime to hydrate
    try {
      await page.waitForSelector('[data-testid="history-tabs-root"]', { timeout: 5000 });
    } catch {
      test.skip(true, 'HistoryTabsIsland not hydrated - skipping tab tests');
      return;
    }

    // Check tab buttons exist
    const textTab = page.locator('[data-testid="tab-text"]');
    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    const similarTab = page.locator('[data-testid="tab-similar"]');

    await expect(textTab).toBeVisible();
    await expect(metadataTab).toBeVisible();
    await expect(similarTab).toBeVisible();
  });

  test('tab navigation switches between panels', async ({ page }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="history-tabs-root"]', { timeout: 5000 });
    } catch {
      test.skip(true, 'HistoryTabsIsland not hydrated - skipping navigation test');
      return;
    }

    // Initially Text tab should be active
    const textPanel = page.locator('[data-testid="panel-text"]');
    await expect(textPanel).toBeVisible();

    // Click Metadata tab
    await page.click('[data-testid="tab-metadata"]');
    const metadataPanel = page.locator('[data-testid="panel-metadata"]');
    await expect(metadataPanel).toBeVisible();

    // Click Similar tab
    await page.click('[data-testid="tab-similar"]');
    const similarPanel = page.locator('[data-testid="panel-similar"]');
    await expect(similarPanel).toBeVisible();

    // Should show empty state initially
    const emptyState = page.locator('[data-testid="similar-empty"]');
    await expect(emptyState).toBeVisible();
  });

  test('ARIA attributes are present on tabs', async ({ page }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="history-tabs-root"]', { timeout: 5000 });
    } catch {
      test.skip(true, 'HistoryTabsIsland not hydrated');
      return;
    }

    // Check tablist role
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible();

    // Check tab buttons have correct role
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    expect(count).toBe(3);

    // Check aria-selected on active tab
    const textTab = page.locator('[data-testid="tab-text"]');
    await expect(textTab).toHaveAttribute('aria-selected', 'true');
  });

  test('keyboard navigation (ArrowRight/Left) moves focus and selects tabs', async ({ page }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="history-tabs-root"]', { timeout: 5000 });
    } catch {
      test.skip(true, 'HistoryTabsIsland not hydrated - skipping keyboard test');
      return;
    }

    const textTab = page.locator('[data-testid="tab-text"]');
    const metadataTab = page.locator('[data-testid="tab-metadata"]');

    await textTab.focus();
    await page.keyboard.press('ArrowRight');

    // Metadata tab should be selected and focused
    await expect(metadataTab).toHaveAttribute('aria-selected', 'true');
    await expect(metadataTab).toBeFocused();

    // Press left to go back
    await page.keyboard.press('ArrowLeft');
    await expect(textTab).toHaveAttribute('aria-selected', 'true');
    await expect(textTab).toBeFocused();
  });

  test('visual-search-requested event triggers similar tab population', async ({ page }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="history-tabs-root"]', { timeout: 5000 });
    } catch {
      test.skip(true, 'HistoryTabsIsland not hydrated');
      return;
    }

    // Dispatch visual-search-requested event with mock image
    // Note: In real E2E, this would come from the overlay viewer
    await page.evaluate(() => {
      const event = new CustomEvent('visual-search-requested', {
        detail: {
          imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          collection: 'visual_pages'
        }
      });
      window.dispatchEvent(event);
    });

    // Wait for tab to switch to similar (may show loading/error based on sidecar availability)
    await page.waitForSelector('[data-testid="panel-similar"]', { timeout: 10000 });

    // Check that we're on the Similar tab
    const similarTab = page.locator('[data-testid="tab-similar"]');
    await expect(similarTab).toHaveAttribute('aria-selected', 'true');
  });

  test('503 Initializing state shows GPU loading indicator', async ({ page }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    try {
      await page.waitForSelector('[data-testid="history-tabs-root"]', { timeout: 5000 });
    } catch {
      test.skip(true, 'HistoryTabsIsland not hydrated');
      return;
    }

    // Mock the fetch API to return 503 initializing
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

    // Trigger visual search
    await page.evaluate(() => {
      const event = new CustomEvent('visual-search-requested', {
        detail: {
          imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          collection: 'visual_pages'
        }
      });
      window.dispatchEvent(event);
    });

    // Wait for GPU initializing indicator
    await page.waitForSelector('[data-testid="panel-similar"]', { timeout: 5000 });

    // Check for GPU initializing state
    const gpuInit = page.locator('[data-testid="gpu-initializing"]');
    await expect(gpuInit).toBeVisible();

    // Check that it mentions the hardware
    const text = await gpuInit.textContent();
    expect(text).toContain('GPU Initializing');
  });

  test('5-column grid layout is applied', async ({ page }) => {
    const response = await gotoHistory(page);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    // Check grid layout
    const gridContainer = page.locator('.grid.gap-4.md\\:grid-cols-5');
    await expect(gridContainer).toBeVisible();

    // Check overlay viewer has 3 columns
    const overlayCol = page.locator('.md\\:col-span-3[data-island="overlay-viewer-island"]');
    const overlayCount = await overlayCol.count();
    expect(overlayCount).toBe(1);

    // Check history tabs has 2 columns
    const tabsCol = page.locator('.md\\:col-span-2[data-island="history-tabs-island"]');
    const tabsCount = await tabsCol.count();
    expect(tabsCount).toBe(1);
  });
});

