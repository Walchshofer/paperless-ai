import { test, expect } from '@playwright/test';

// The full pipeline (Stages 1-9) can take up to ~180 s on constrained hardware.
// 300 s provides a safe headroom of 2x the observed worst-case run time.
const TEST_TIMEOUT_MS = 300_000;

// How long to wait for the reprocess notification.  The pipeline itself runs
// up to ~180 s; 240 s gives a 60 s margin inside the overall 300 s budget.
const REPROCESS_API_TIMEOUT_MS = 240_000;

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const DOC_ID = 74;

test.describe('Normalization Verification', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await page.goto(`${BASE_URL}/workspace/doc/${DOC_ID}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      });
    } catch (e) {
      test.skip(true, 'Backend not reachable');
      return;
    }
    if (page.url().includes('/login')) {
      test.skip(true, 'Auth storage state stale');
      return;
    }
    await expect(page.locator('[data-testid="reprocess-btn"]')).toBeVisible({
      timeout: 30_000,
    });
  });

  test('should reprocess document and show normalized status', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    const reprocessBtn = page.locator('[data-testid="reprocess-btn"]');

    // 1. Trigger Reprocess
    await reprocessBtn.click();
    await expect(reprocessBtn).toContainText('Reprocessing...');

    // 2. Wait for success notification
    const notification = page.locator('[data-testid="reprocess-notification"]');
    await expect(notification).toBeVisible({ timeout: REPROCESS_API_TIMEOUT_MS });
    await expect(notification).toContainText('successfully');

    // 3. Switch to Visual Tab
    const visualTabBtn = page.locator('button[data-testid="tab-visual"]');
    await visualTabBtn.click();

    // 4. Verify Normalization Indicator
    const statusIndicator = page.locator('[data-testid="normalization-status-indicator"]');
    await expect(statusIndicator).toBeVisible({ timeout: 10000 });

    // It should say "Persisted (Normalized)" if Stage 3 succeeded and persisted the file
    await expect(statusIndicator).toContainText('Persisted (Normalized)');

    // 5. Verify Image Source
    // The image src should point to the normalized endpoint
    const image = page.locator('[data-testid="overlay-document-image"]');
    await expect(image).toBeVisible();
    const src = await image.getAttribute('src');
    expect(src).toContain(`/api/visual-rag/normalized/${DOC_ID}`);

    // 6. Visual Snapshot (optional, for human review via artifacts)
    await page.waitForTimeout(2000); // Allow image to render
    await page.screenshot({ path: `test-results/normalization-doc-${DOC_ID}.png`, fullPage: true });
  });
});
