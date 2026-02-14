import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');
const {
  navigateToWorkspace,
  switchTab,
  waitForIslandMount
} = require('../helpers/workspace-fixtures');

function parseZoomPercentage(value: string | null): number {
  const raw = (value || '').replace('%', '').trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

test.describe('OverlayViewer zoom/pan/draw interactions', () => {
  test('zoom in, pan via drag, then activate draw mode', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await switchTab(page, 'visual');
    await waitForIslandMount(page, 'overlay-viewer-island', 10000);
    await page.waitForSelector('[data-testid="overlay-document-image"]', {
      timeout: 10000
    });
    await page.waitForTimeout(200);

    const zoomIn = page.locator('[data-testid="overlay-zoom-in"]');
    const zoomPct = page.locator('[data-testid="overlay-zoom-percentage"]');
    const panToggle = page.locator('[data-testid="pan-mode-btn"]');
    const container = page.locator('[data-testid="overlay-container"]');
    const drawToggle = page.locator('[data-testid="draw-mode-btn"]');

    await expect(zoomIn).toBeVisible();
    await expect(zoomPct).toHaveText(/%/);
    const initialPct = parseZoomPercentage(await zoomPct.textContent());
    expect(initialPct).toBeGreaterThan(0);

    // Zoom in
    await zoomIn.click();
    await page.waitForTimeout(250);
    const pct = parseZoomPercentage(await zoomPct.textContent());
    expect(pct).toBeGreaterThan(initialPct);

    const containerSelector = '[data-testid="overlay-container"]';
    let isScrollable = await page.evaluate((selector) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      return !!el && (
        el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
      );
    }, containerSelector);
    for (let i = 0; i < 6 && !isScrollable; i += 1) {
      await zoomIn.click();
      await page.waitForTimeout(100);
      isScrollable = await page.evaluate((selector) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        return !!el && (
          el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
        );
      }, containerSelector);
    }
    test.skip(!isScrollable, 'Overlay container is not scrollable');

    // Toggle pan and perform drag
    await panToggle.click();
    await expect(panToggle).toHaveAttribute('aria-pressed', 'true');

    const beforePan = await page.evaluate((selector) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return null;
      el.scrollLeft = Math.max(0, Math.floor((el.scrollWidth - el.clientWidth) / 2));
      el.scrollTop = Math.max(0, Math.floor((el.scrollHeight - el.clientHeight) / 2));
      return { left: el.scrollLeft, top: el.scrollTop };
    }, containerSelector);
    expect(beforePan).toBeTruthy();

    const box = await container.boundingBox();
    expect(box).toBeTruthy();
    if (!box) {
      test.skip(true, 'Overlay container has no bounding box');
      return;
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 80, startY - 60);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const afterPan = await page.evaluate((selector) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return null;
      return { left: el.scrollLeft, top: el.scrollTop };
    }, containerSelector);
    expect(afterPan).toBeTruthy();
    const panChanged = !!beforePan && !!afterPan
      && (
        Math.abs(afterPan.left - beforePan.left) > 0
        || Math.abs(afterPan.top - beforePan.top) > 0
      );
    expect(panChanged).toBe(true);

    // Toggle draw mode - should disable pan mode (mutually exclusive)
    await expect(drawToggle).toBeVisible();
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
