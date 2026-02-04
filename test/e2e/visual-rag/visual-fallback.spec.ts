import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../../helpers/fixtures');
const { navigateToWorkspace, switchTab } = require('../../helpers/workspace-fixtures');

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
    await switchTab(page, 'visual');

    await page.getByTestId('visual-search-btn').click();

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
