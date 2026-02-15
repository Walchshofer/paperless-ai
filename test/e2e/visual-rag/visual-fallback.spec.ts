import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../../helpers/fixtures');
const { navigateToWorkspace, switchTab, waitForIslandMount } = require('../../helpers/workspace-fixtures');

test.describe('Visual-RAG fallback behavior', () => {
  test('shows error panel when visual search returns 503', async ({ page }) => {
    const docId = getTestDocId();

    await page.route('**/api/visual-rag/search/visual', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Service unavailable' })
      });
    });

    await navigateToWorkspace(page, docId);
    // Wait for sidebar island hydration before switching tabs to avoid
    // clicking the static EJS fallback which resets on Preact hydration.
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
    await switchTab(page, 'visual');

    // Wait for the document image to fully load before triggering visual search.
    // captureRegion in OverlayViewerIsland returns early when imageLoaded is false,
    // preventing the visual-search-requested event from being dispatched.
    await page.waitForFunction(
      () => {
        const img = document.querySelector(
          '[data-testid="overlay-document-image"]'
        ) as HTMLImageElement | null;
        return img != null && img.naturalWidth > 0;
      },
      { timeout: 15000 }
    );

    await page.getByTestId('visual-search-btn').click();

    // Wait for draw mode to become active in VisualTabIsland before drawing.
    // Clicking visual-search-btn dispatches overlay:activate-draw-mode which
    // sets drawModeRef in OverlayViewerIsland; the cancel-draw-btn appearing
    // in VisualTabIsland confirms draw mode is ready.
    await page.waitForSelector('[data-testid="cancel-draw-btn"]', {
      timeout: 5000
    });

    const container = page.getByTestId('overlay-container');
    const box = await container.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 60, box.y + 60);
      await page.mouse.down();
      await page.mouse.move(box.x + 160, box.y + 160);
      await page.mouse.up();
    }

    await page.waitForSelector('[data-testid="visual-search-results-panel"]', { state: 'visible', timeout: 15000 });
    await expect(page.locator('[data-testid="visual-search-results-panel"]')).toContainText('Search failed: 503');
  });
});
