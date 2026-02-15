import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');
const { navigateToWorkspace, switchTab, waitForIslandMount } = require('../helpers/workspace-fixtures');

test.describe('Workspace Enhancements', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/visual-rag/search/visual', async route => {
      await route.fulfill({
        json: {
          results: [
            { document_id: 123, page: 1, score: 0.95, title: 'Test Document', thumbnail: '' },
            { document_id: 456, page: 1, score: 0.88, title: 'Similar Doc', thumbnail: '' }
          ]
        }
      });
    });
  });

  test('Document Content Search', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    // Wait for sidebar island hydration before switching tabs to avoid
    // clicking the static EJS fallback which resets on Preact hydration.
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
    await switchTab(page, 'content');

    await expect(page.getByTestId('document-content-island-root')).toBeVisible();

    const contentText = await page.getByTestId('document-content-area').textContent();
    const wordMatch = contentText?.match(/\b[a-zA-Z]{4,}\b/);
    if (!wordMatch) {
      test.skip(true, 'No searchable content available in OCR panel');
      return;
    }

    const query = wordMatch[0];
    await page.getByTestId('search-input').fill(query);

    await expect(page.getByTestId('search-count')).not.toContainText('0/0');
    await expect(page.locator('mark')).toContainText(query);
  });

  test('Visual Search Panel', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    // Wait for sidebar island hydration before switching tabs.
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
    await switchTab(page, 'visual');
    await expect(page.getByTestId('overlay-viewer-root')).toBeVisible();

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
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 150);
      await page.mouse.up();
    }

    await expect(page.getByTestId('visual-search-results-panel')).toBeVisible({
      timeout: 15000
    });
    await expect(page.getByText('Visual Search Results')).toBeVisible();
    await expect(page.getByText('Similar Doc')).toBeVisible();
  });
});
