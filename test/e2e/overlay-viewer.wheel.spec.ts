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

test.describe('OverlayViewer wheel zoom (E2E)', () => {
  test('mouse wheel zooms towards pointer and Ctrl fine control reduces step', async ({ page }) => {
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

    // Dispatch a coarse wheel event (deltaY negative to zoom in)
    await page.evaluate(() => {
      const c = document.querySelector('[data-testid="overlay-container"]');
      if (!c) return;
      const ev = new WheelEvent('wheel', { deltaY: -100, clientX: 50, clientY: 50, bubbles: true, cancelable: true });
      c.dispatchEvent(ev);
    });

    await page.waitForTimeout(200);
    const pctAfter = parseZoomPercentage(await zoomPct.textContent());
    expect(pctAfter).toBeGreaterThan(initialPct);

    const coarseDelta = pctAfter - initialPct;

    // Dispatch a fine wheel (ctrlKey true)
    await page.evaluate(() => {
      const c = document.querySelector('[data-testid="overlay-container"]');
      if (!c) return;
      const ev = new WheelEvent('wheel', { deltaY: -100, clientX: 60, clientY: 60, ctrlKey: true, bubbles: true, cancelable: true });
      c.dispatchEvent(ev);
    });

    await page.waitForTimeout(200);
    const pctAfterFine = parseZoomPercentage(await zoomPct.textContent());
    const fineDelta = pctAfterFine - pctAfter;

    expect(fineDelta).toBeGreaterThan(0);
    expect(fineDelta).toBeLessThan(coarseDelta + 1e-6);
  });
});
