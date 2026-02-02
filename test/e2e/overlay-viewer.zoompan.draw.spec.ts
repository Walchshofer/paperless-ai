import { test, expect } from '@playwright/test';

test.describe('OverlayViewer zoom/pan/draw interactions', () => {
  test('zoom in, pan via drag, then activate draw mode', async ({ page }) => {
    await page.goto('/workspace/doc/74');
    await page.waitForSelector('[data-testid="overlay-viewer-island"]', { timeout: 30000 });
    await page.waitForTimeout(500);

    const zoomIn = page.locator('[data-testid="overlay-zoom-in"]');
    const zoomPct = page.locator('[data-testid="overlay-zoom-percentage"]');
    const panToggle = page.locator('[data-testid="pan-mode-btn"]');
    const container = page.locator('[data-testid="overlay-container"]');
    const viewport = page.locator('[data-testid="overlay-viewport"]');
    const drawToggle = page.locator('[data-testid="draw-mode-btn"]');

    await expect(zoomIn).toBeVisible();
    await expect(zoomPct).toHaveText(/100%/);

    // Zoom in
    await zoomIn.click();
    await page.waitForTimeout(250);
    const pct = (await zoomPct.textContent()) || '100%';
    expect(Number(pct.replace('%', ''))).toBeGreaterThan(100);

    // Toggle pan and perform drag
    await panToggle.click();
    await expect(panToggle).toHaveAttribute('aria-pressed', 'true');
    
    await page.mouse.move(200, 200);
    await page.mouse.down();
    await page.mouse.move(250, 220);
    await page.mouse.up();
    await page.waitForTimeout(200);

    // viewport transform should reflect translate values via CSS custom property in className
    const viewportClass = await viewport.getAttribute('class');
    expect(viewportClass).toContain('--viewport-transform:translate(');

    // Toggle draw mode - should disable pan mode (mutually exclusive)
    await drawToggle.click();
    await page.waitForTimeout(100);
    
    // Verify draw mode is active
    await expect(drawToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(container).toHaveAttribute('data-draw-mode', 'active');
    
    // Verify pan mode is now inactive (mutually exclusive)
    await expect(panToggle).toHaveAttribute('aria-pressed', 'false');
    
    // Verify cursor changes to crosshair in draw mode
    const containerClass = await container.getAttribute('class');
    expect(containerClass).toContain('cursor-crosshair');
  });
});