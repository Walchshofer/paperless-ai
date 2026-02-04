import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');
const { navigateToWorkspace, switchTab } = require('../helpers/workspace-fixtures');

test.describe('Workspace Visual Tab - Overlay Viewer', () => {
  test('mounts overlay viewer and activates draw mode', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await switchTab(page, 'visual');

    await expect(page.locator('[data-testid="overlay-viewer-root"]')).toBeVisible();
    await expect(page.locator('[data-testid="visual-tab-panel"]')).toBeVisible();

    const searchBtn = page.locator('[data-testid="visual-search-btn"]');
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();

    const cancelBtn = page.locator('[data-testid="cancel-draw-btn"]');
    await expect(cancelBtn).toBeVisible();

    const canvas = page.locator('[data-testid="annotation-canvas"]').first();
    await expect(canvas).toBeVisible();
  });
});
