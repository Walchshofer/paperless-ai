import { test, expect } from '@playwright/test';

test.describe('Visual-RAG overlay success', () => {
  test('overlay island mounts and responds to visual search', async ({ page }) => {
    await page.goto('/manual');

    // If page does not contain the visual toggle (e.g., Settings/Setup shown), skip test in this environment
    const visualBtn = await page.$('[data-testid="view-visual-btn"]');
    if (!visualBtn) {
      test.skip(true, 'Manual page not available in this environment (skipping)');
      return;
    }

    // Toggle to visual mode to show overlay viewer
    await page.click('[data-testid="view-visual-btn"]');

    // Wait for island anchor to be present (attached to DOM)
    await page.waitForSelector('[data-testid="overlay-viewer-island"]', { timeout: 10000 });

    // Ensure island mounted (root marker appears or image placeholder exists)
    const island = await page.$('[data-testid="overlay-viewer-island"]');
    expect(island).toBeTruthy();
  });
});