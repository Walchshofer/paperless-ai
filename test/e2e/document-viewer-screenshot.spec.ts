/**
 * Document Viewer Screenshot Verification Test
 * 
 * This test captures a screenshot to visually verify the document
 * is rendering correctly in the viewer.
 */

import { test, expect } from '@playwright/test';

const {
  navigateToWorkspace,
  waitForIslandMount
} = require('../helpers/workspace-fixtures');
const { getTestDocId } = require('../helpers/fixtures');

test.describe('Document Viewer Screenshot Verification', () => {
  test('should display normalized document image in viewer', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'overlay-viewer-island');

    // Wait for the overlay viewer island to be present
    const viewer = page.locator('[data-island="overlay-viewer-island"]');
    await expect(viewer).toBeVisible({ timeout: 15000 });

    // Wait for image to load - check for img element with src
    const img = viewer.locator('[data-testid="overlay-document-image"]');
    await expect(img).toBeVisible({ timeout: 30000 });
    
    // Get the image src to verify it's loaded
    const imgSrc = await img.getAttribute('src');
    console.log('Image src:', imgSrc);
    
    // Current contract: src can be normalized endpoint, paperless fallback,
    // or blob URL depending on loading strategy.
    expect(imgSrc).toBeTruthy();
    const isExpectedSource = Boolean(
      imgSrc &&
      (
        imgSrc.startsWith('blob:') ||
        imgSrc.includes('/api/visual-rag/normalized/') ||
        imgSrc.includes('/api/documents/')
      )
    );
    expect(isExpectedSource).toBe(true);
    
    // Check that image has natural dimensions (actually loaded)
    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    const naturalHeight = await img.evaluate((el: HTMLImageElement) => el.naturalHeight);
    console.log(`Image dimensions: ${naturalWidth}x${naturalHeight}`);
    
    expect(naturalWidth).toBeGreaterThan(100);
    expect(naturalHeight).toBeGreaterThan(100);

    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'test-results/document-viewer-loaded.png',
      fullPage: false 
    });
    
    console.log('✅ Screenshot saved to test-results/document-viewer-loaded.png');
    
    // Also verify there's no error state
    await expect(page.locator('[data-testid="image-error"]')).toHaveCount(0);
  });
});
