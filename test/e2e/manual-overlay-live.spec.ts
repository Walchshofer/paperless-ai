import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');
const { waitForIsland } = require('../helpers/island-waits');
const { navigateToWorkspace, switchTab } = require('../helpers/workspace-fixtures');

test.describe('Workspace Overlay - Live Integration', () => {
  test('OverlayViewer responds to real document changes', async ({ page }) => {
    const testDocId = getTestDocId();

    await navigateToWorkspace(page, testDocId);
    await switchTab(page, 'visual');

    await waitForIsland(page, 'overlay-viewer-island', 10000);

    const overlayRoot = page.locator('[data-testid="overlay-viewer-root"]');
    await expect(overlayRoot).toBeVisible();
    await expect(overlayRoot).toHaveAttribute('data-original-url', /documents/i, {
      timeout: 15000
    });

    const docImage = page.locator('[data-testid="overlay-document-image"]');
    await expect(docImage).toBeVisible();

    const nextBtn = page.locator('[data-testid="overlay-next-page"]');
    const pageIndicator = page.locator('[data-testid="overlay-page-indicator"]');
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await expect(pageIndicator).toContainText('Page 2');

      const prevBtn = page.locator('[data-testid="overlay-prev-page"]');
      await prevBtn.click();
      await expect(pageIndicator).toContainText('Page 1');
    }
  });
});
