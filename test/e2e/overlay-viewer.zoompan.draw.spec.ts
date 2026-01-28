import { test, expect } from '@playwright/test';

test.describe('OverlayViewer zoom/pan/draw interactions', () => {
  test('zoom in, pan via drag, then draw region (Region 1 appears)', async ({ page }) => {
    await page.goto('/manual');
    await page.waitForSelector('[data-island="overlay-viewer-island"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    const zoomIn = page.locator('[data-testid="overlay-zoom-in"]');
    const zoomPct = page.locator('[data-testid="overlay-zoom-percentage"]');
    const panToggle = page.locator('[data-testid="overlay-pan-toggle"]');
    const container = page.locator('[data-testid="overlay-container"]');
    const viewport = page.locator('[data-testid="overlay-viewport"]');
    const drawToggle = page.locator('[data-testid="red-pen-toggle"]');

    await expect(zoomIn).toBeVisible();
    await expect(zoomPct).toHaveText(/100%/);

    await zoomIn.click();
    await page.waitForTimeout(250);
    const pct = (await zoomPct.textContent()) || '100%';
    expect(Number(pct.replace('%', ''))).toBeGreaterThan(100);

    // Toggle pan and perform drag
    await panToggle.click();
    await page.mouse.move(200, 200);
    await page.mouse.down();
    await page.mouse.move(250, 220);
    await page.mouse.up();
    await page.waitForTimeout(200);

    // viewport transform should reflect translate values
    const style = await viewport.getAttribute('style');
    expect(style).toContain('translate(');

    // Toggle draw mode and draw a small region
    await drawToggle.click();
    // Start drawing in center-ish of container
    const box = await container.boundingBox();
    if (!box) throw new Error('Overlay container bounding box not available');

    const startX = Math.round(box.x + box.width / 3);
    const startY = Math.round(box.y + box.height / 3);
    const endX = startX + 40;
    const endY = startY + 30;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();

    // Wait for box label to appear
    await page.waitForSelector('text=Region 1', { timeout: 2000 });
    const label = await page.locator('text=Region 1');
    await expect(label).toBeVisible();
  });
});