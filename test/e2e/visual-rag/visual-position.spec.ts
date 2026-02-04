import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../../helpers/fixtures');
const { navigateToWorkspace, switchTab } = require('../../helpers/workspace-fixtures');

test.describe('Visual overlay position verification', () => {
  test('highlight region reflects overlay bbox percentages', async ({ page }) => {
    const docId = getTestDocId();
    const overlayId = 'ov-pos-1';
    const bbox = { x: 0.12, y: 0.34, width: 0.56, height: 0.22 };

    await page.route(`**/api/visual-overlays/missing-fields/${docId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ fields: [] })
      });
    });

    await page.route(`**/api/visual-overlays/document/${docId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          overlays: [
            {
              id: overlayId,
              label: 'Invoice Number',
              pageNumber: 1,
              confidence: 0.91,
              bbox
            }
          ]
        })
      });
    });

    await navigateToWorkspace(page, docId);
    await switchTab(page, 'visual');

    const viewButton = page.locator(`[data-testid="view-overlay-${overlayId}"]`);
    await expect(viewButton).toBeVisible();
    await viewButton.click();

    const highlight = page.locator('[data-testid="overlay-highlight-region"]');
    await expect(highlight).toBeVisible();
    await expect(highlight).toHaveClass(new RegExp(`--region-left:${bbox.x * 100}%`));
    await expect(highlight).toHaveClass(new RegExp(`--region-top:${bbox.y * 100}%`));
    await expect(highlight).toHaveClass(new RegExp(`--region-width:${bbox.width * 100}%`));
    await expect(highlight).toHaveClass(new RegExp(`--region-height:${bbox.height * 100}%`));
  });
});
