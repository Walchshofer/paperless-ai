import { test, expect } from '@playwright/test';
import { getTestDocId } from '../helpers/fixtures';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Workspace Document Viewer Full Verification', () => {
  test('verify document visibility and all toolbar tools', async ({ page }) => {
    const docId = getTestDocId();
    const url = `${BASE_URL}/workspace/doc/${docId}?tab=metadata`;
    
    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // 1. Verify Document Viewer is visible and hydrated
    const viewerRoot = page.locator('[data-testid="overlay-viewer-root"]');
    await expect(viewerRoot).toBeVisible({ timeout: 15000 });
    await expect(viewerRoot).toHaveAttribute('data-hydrated', 'true');

    // Verify document image is attempting to load or loaded
    const docImage = page.locator('[data-testid="overlay-document-image"]');
    // It might be hidden if still loading, but it should be in the DOM
    await expect(docImage).toBeAttached();
    
    // 2. Test Pan Mode
    const panBtn = page.locator('[data-testid="pan-mode-btn"]');
    await panBtn.click();
    await expect(panBtn).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: 'test-results/viewer-pan-active.png' });

    // 3. Test Draw Mode
    const drawBtn = page.locator('[data-testid="draw-mode-btn"]');
    if (await drawBtn.isVisible()) {
      await drawBtn.click();
      await expect(drawBtn).toHaveAttribute('aria-pressed', 'true');
      await expect(panBtn).toHaveAttribute('aria-pressed', 'false'); // Mutually exclusive
      await page.screenshot({ path: 'test-results/viewer-draw-active.png' });
    }

    // 4. Test Measure Mode
    const measureBtn = page.locator('[data-testid="measure-mode-btn"]');
    await measureBtn.click();
    await expect(measureBtn).toHaveClass(/bg-\[#b87333\]/); // Active color
    await expect(page.locator('[data-testid="measure-instructions"]')).toBeVisible();
    await page.screenshot({ path: 'test-results/viewer-measure-active.png' });

    // 5. Test Zoom
    const zoomIn = page.locator('[data-testid="overlay-zoom-in"]');
    const zoomOut = page.locator('[data-testid="overlay-zoom-out"]');
    const zoomPct = page.locator('[data-testid="overlay-zoom-percentage"]');
    
    const initialZoom = await zoomPct.textContent();
    await zoomIn.click();
    await page.waitForTimeout(200);
    const zoomedIn = await zoomPct.textContent();
    expect(Number(zoomedIn?.replace('%', ''))).toBeGreaterThan(Number(initialZoom?.replace('%', '')));

    await zoomOut.click();
    await zoomOut.click();
    await page.waitForTimeout(200);
    const zoomedOut = await zoomPct.textContent();
    expect(Number(zoomedOut?.replace('%', ''))).toBeLessThan(Number(zoomedIn?.replace('%', '')));

    // 6. Test Rotate
    const rotateBtn = page.locator('[data-testid="overlay-rotate-cw"]');
    const rotationText = page.locator('[data-testid="overlay-rotation-degrees"]');
    
    await rotateBtn.click();
    await expect(rotationText).toHaveText('90°');
    await page.screenshot({ path: 'test-results/viewer-rotated-90.png' });

    // 7. Test Fit Buttons
    const fitWidth = page.locator('[data-testid="overlay-fit-width"]');
    const fitHeight = page.locator('[data-testid="overlay-fit-height"]');
    
    await fitWidth.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/viewer-fit-width.png' });

    await fitHeight.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/viewer-fit-height.png' });

    // 8. Test Page Navigation
    const nextBtn = page.locator('[data-testid="overlay-next-page"]');
    const pageIndicator = page.locator('[data-testid="overlay-page-indicator"]');
    
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await expect(pageIndicator).toContainText('Page 2');
      await page.screenshot({ path: 'test-results/viewer-page-2.png' });
    }

    console.log('Verification complete. Screenshots saved to test-results/');
  });
});
