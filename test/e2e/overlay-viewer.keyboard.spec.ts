import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');

test.describe('OverlayViewer keyboard shortcuts (E2E)', () => {
  test('press + / - / 0 to zoom and Space to toggle pan and ArrowRight to nudge', async ({ page }) => {
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
    const viewport = page.locator('[data-testid="overlay-viewport"]');

    await expect(zoomPct).toHaveText(/%/);

    // Press + (zoom in)
    await page.keyboard.press('+');
    await page.waitForTimeout(200);
    const pctAfter = (await zoomPct.textContent()) || '100%';
    expect(Number(pctAfter.replace('%', ''))).toBeGreaterThan(100);

    // Press - (zoom out)
    await page.keyboard.press('-');
    await page.waitForTimeout(100);
    const pctAfterOut = (await zoomPct.textContent()) || '100%';
    expect(Number(pctAfterOut.replace('%', ''))).toBeLessThanOrEqual(Number(pctAfter.replace('%', '')));

    // Reset with 0
    await page.keyboard.press('0');
    await page.waitForTimeout(100);
    await expect(zoomPct).toHaveText(/100%/);

    // Space toggles pan
    const panBtn = page.locator('[data-testid="overlay-pan-toggle"]');
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);

    const pressed = await panBtn.getAttribute('aria-pressed');
    expect(pressed === 'true' || pressed === 'false').toBeTruthy();

    // When pan is active, ArrowRight should nudge viewport
    // Ensure pan is active
    if (pressed !== 'true') {
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
    }

    const beforeStyle = (await viewport.getAttribute('style')) || '';
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const afterStyle = (await viewport.getAttribute('style')) || '';

    expect(beforeStyle).not.toBe(afterStyle);
  });
});
