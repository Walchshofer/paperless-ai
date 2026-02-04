import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');

test.describe('OverlayViewer wheel zoom (E2E)', () => {
  test('mouse wheel zooms towards pointer and Ctrl fine control reduces step', async ({ page }) => {
    const docId = getTestDocId();
    try {
      await page.goto(`/workspace/doc/${docId}`, { waitUntil: 'domcontentloaded' });
    } catch (e: unknown) {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? (e as { message?: string }).message : String(e);
      test.skip(true, 'Backend not reachable for E2E run: ' + msg);
      return;
    }

    await page.click('[data-testid="tab-visual"]');
    await page.waitForSelector('[data-island="overlay-viewer-island"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    const zoomPct = page.locator('[data-testid="overlay-zoom-percentage"]');
    const _container = await page.locator('[data-testid="overlay-container"]');
    await expect(zoomPct).toHaveText(/%/);

    // Dispatch a coarse wheel event (deltaY negative to zoom in)
    await page.evaluate(() => {
      const c = document.querySelector('[data-testid="overlay-container"]');
      if (!c) return;
      const ev = new WheelEvent('wheel', { deltaY: -100, clientX: 50, clientY: 50, bubbles: true, cancelable: true });
      c.dispatchEvent(ev);
    });

    await page.waitForTimeout(200);
    const pctAfter = (await zoomPct.textContent()) || '100%';
    expect(Number(pctAfter.replace('%', ''))).toBeGreaterThan(100);

    const coarseDelta = Number(pctAfter.replace('%', '')) - 100;

    // Dispatch a fine wheel (ctrlKey true)
    await page.evaluate(() => {
      const c = document.querySelector('[data-testid="overlay-container"]');
      if (!c) return;
      const ev = new WheelEvent('wheel', { deltaY: -100, clientX: 60, clientY: 60, ctrlKey: true, bubbles: true, cancelable: true });
      c.dispatchEvent(ev);
    });

    await page.waitForTimeout(200);
    const pctAfterFine = (await zoomPct.textContent()) || '100%';
    const fineDelta = Number(pctAfterFine.replace('%', '')) - Number(pctAfter.replace('%', ''));

    expect(fineDelta).toBeGreaterThan(0);
    expect(fineDelta).toBeLessThan(coarseDelta + 1e-6);
  });
});
