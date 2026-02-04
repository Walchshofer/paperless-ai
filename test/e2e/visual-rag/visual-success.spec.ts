import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../../helpers/fixtures');
const { navigateToWorkspace, switchTab } = require('../../helpers/workspace-fixtures');

test.describe('Visual-RAG overlay success', () => {
  test('visual tab renders overlays returned by API', async ({ page }) => {
    const docId = getTestDocId();

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
              id: 'ov-success-1',
              label: 'Invoice Number',
              pageNumber: 1,
              confidence: 0.95,
              bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.25 }
            }
          ]
        })
      });
    });

    await navigateToWorkspace(page, docId);
    await switchTab(page, 'visual');

    await page.waitForSelector('[data-testid="overlay-ov-success-1"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="overlay-ov-success-1"]')).toBeVisible();
  });
});
