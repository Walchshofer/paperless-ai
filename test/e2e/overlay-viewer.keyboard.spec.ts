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

test.describe('OverlayViewer keyboard shortcuts (E2E)', () => {
  test('press + / - / 0 to zoom and Space to toggle pan and ArrowRight to nudge', async ({ page }) => {
    const docId = getTestDocId();
    try {
      await navigateToWorkspace(page, docId);
    } catch (e: unknown) {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? (e as { message?: string }).message : String(e);
      test.skip(true, 'Backend not reachable for E2E run: ' + msg);
      return;
    }

    await switchTab(page, 'visual');
    await waitForIslandMount(page, 'overlay-viewer-island', 10000);
    await page.waitForSelector('[data-testid="overlay-document-image"]', {
      timeout: 10000
    });
    await page.waitForTimeout(200);

    const zoomPct = page.locator('[data-testid="overlay-zoom-percentage"]');

    await expect(zoomPct).toHaveText(/%/);
    const initialPct = parseZoomPercentage(await zoomPct.textContent());
    expect(initialPct).toBeGreaterThan(0);

    // Press = (zoom in handler supports + and =)
    await page.keyboard.press('=');
    await page.waitForTimeout(200);
    const pctAfter = parseZoomPercentage(await zoomPct.textContent());
    expect(pctAfter).toBeGreaterThan(initialPct);

    // Press - (zoom out)
    await page.keyboard.press('-');
    await page.waitForTimeout(100);
    const pctAfterOut = parseZoomPercentage(await zoomPct.textContent());
    expect(pctAfterOut).toBeLessThanOrEqual(pctAfter);

    // Reset with 0
    await page.keyboard.press('0');
    await page.waitForTimeout(100);
    await expect(zoomPct).toHaveText(/100%/);

    // Space toggles pan
    const panBtn = page.locator('[data-testid="pan-mode-btn"]');
    const beforePressed = await panBtn.getAttribute('aria-pressed');
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);

    const pressed = await panBtn.getAttribute('aria-pressed');
    expect(pressed === 'true' || pressed === 'false').toBeTruthy();
    expect(pressed).not.toBe(beforePressed);

    // When pan is active, ArrowRight should nudge viewport
    // Ensure pan is active
    if (pressed !== 'true') {
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
    }

    const containerSelector = '[data-testid="overlay-container"]';
    let isScrollable = await page.evaluate((selector) => {
      const container = document.querySelector(selector) as HTMLElement | null;
      return !!container && container.scrollWidth > container.clientWidth;
    }, containerSelector);

    for (let i = 0; i < 6 && !isScrollable; i += 1) {
      await page.keyboard.press('=');
      await page.waitForTimeout(100);
      isScrollable = await page.evaluate((selector) => {
        const container = document.querySelector(selector) as HTMLElement | null;
        return !!container && container.scrollWidth > container.clientWidth;
      }, containerSelector);
    }

    test.skip(!isScrollable, 'Overlay container is not horizontally scrollable');

    const beforeScrollLeft = await page.evaluate((selector) => {
      const container = document.querySelector(selector) as HTMLElement | null;
      return container?.scrollLeft ?? 0;
    }, containerSelector);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const afterScrollLeft = await page.evaluate((selector) => {
      const container = document.querySelector(selector) as HTMLElement | null;
      return container?.scrollLeft ?? 0;
    }, containerSelector);

    expect(afterScrollLeft).toBeGreaterThan(beforeScrollLeft);
  });
});
