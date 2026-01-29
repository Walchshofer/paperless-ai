import { test, expect } from '@playwright/test';

// Basic E2E to verify overlay viewer zoom/pan toolbar and Reset
test.describe('OverlayViewer interactions', () => {
  test('toolbar zoom & reset update viewport and reset works', async ({ page }) => {
    // Navigate to a page that mounts the overlay viewer island (manual page)
    await page.goto('/manual');

    // Wait for island anchor and mount
    await page.waitForSelector('[data-island="overlay-viewer-island"]', { timeout: 5000 });
    // Give island a chance to hydrate
    await page.waitForTimeout(500);

    const zoomIn = await page.locator('[data-testid="overlay-zoom-in"]');
    const zoomPct = await page.locator('[data-testid="overlay-zoom-percentage"]');
    const zoomReset = await page.locator('[data-testid="overlay-zoom-reset"]');

    await expect(zoomIn).toBeVisible();
    await expect(zoomPct).toHaveText(/100%/);

    await zoomIn.click();
    await page.waitForTimeout(200);

    // After clicking zoom in, percentage should reflect > 100%
    const newPct = (await zoomPct.textContent()) || '';
    expect(Number(newPct.replace('%',''))).toBeGreaterThan(100);

    // Reset should bring it back
    await zoomReset.click();
    await page.waitForTimeout(100);
    await expect(zoomPct).toHaveText('100%');
  });

  test('accessibility: ARIA attributes are valid strings', async ({ page }) => {
    await page.goto('/manual');
    await page.waitForSelector('[data-island="overlay-viewer-island"]', { timeout: 5000 });
    
    const panToggle = page.locator('[data-testid="overlay-pan-toggle"]');
    // Default state: false
    await expect(panToggle).toHaveAttribute('aria-pressed', 'false');
    
    // Toggle: true
    await panToggle.click();
    await expect(panToggle).toHaveAttribute('aria-pressed', 'true');
    
    // Toggle back: false
    await panToggle.click();
    await expect(panToggle).toHaveAttribute('aria-pressed', 'false');
  });
});