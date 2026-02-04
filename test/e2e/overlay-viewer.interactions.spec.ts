import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');
const { navigateToWorkspace, switchTab } = require('../helpers/workspace-fixtures');

// Basic E2E to verify overlay viewer zoom/pan toolbar and Reset
test.describe('OverlayViewer interactions', () => {
  test('toolbar zoom & reset update viewport and reset works', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await switchTab(page, 'visual');

    await page.waitForSelector('[data-island="overlay-viewer-island"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    const zoomIn = await page.locator('[data-testid="overlay-zoom-in"]');
    const zoomPct = await page.locator('[data-testid="overlay-zoom-percentage"]');
    const zoomReset = await page.locator('[data-testid="overlay-zoom-reset"]');

    await expect(zoomIn).toBeVisible();
    await expect(zoomPct).toHaveText(/%/);

    await zoomIn.click();
    await page.waitForTimeout(200);

    const newPct = (await zoomPct.textContent()) || '';
    expect(Number(newPct.replace('%',''))).toBeGreaterThan(100);

    await zoomReset.click();
    await page.waitForTimeout(100);
    await expect(zoomPct).toHaveText('100%');
  });

  test('accessibility: ARIA attributes are valid strings', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await switchTab(page, 'visual');
    await page.waitForSelector('[data-island="overlay-viewer-island"]', { timeout: 5000 });

    const panToggle = page.locator('[data-testid="overlay-pan-toggle"]');
    await expect(panToggle).toHaveAttribute('aria-pressed', 'false');

    await panToggle.click();
    await expect(panToggle).toHaveAttribute('aria-pressed', 'true');

    await panToggle.click();
    await expect(panToggle).toHaveAttribute('aria-pressed', 'false');
  });
});
