/**
 * Document Viewer Screenshot Verification Test
 * 
 * This test captures a screenshot to visually verify the document
 * is rendering correctly in the viewer.
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Document Viewer Screenshot Verification', () => {
  test('should display normalized document image in viewer', async ({ page }) => {
    // Navigate to workspace with document 2 (Standtrockner Pegasus)
    await page.goto(`${BASE}/workspace/doc/2`, { waitUntil: 'networkidle' });
    
    // Wait for authentication redirect if needed
    if (page.url().includes('/login')) {
      console.log('Login required, authenticating...');
      await page.fill('input[name="username"]', 'elfman');
      await page.fill('input[name="password"]', 'P2tr3ck!1976');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/workspace\/doc\/2/);
    }

    // Wait for the overlay viewer island to be present
    const viewer = page.locator('[data-island="overlay-viewer-island"]');
    await expect(viewer).toBeVisible({ timeout: 15000 });

    // Wait for image to load - check for img element with src
    const img = viewer.locator('img');
    await expect(img).toBeVisible({ timeout: 30000 });
    
    // Get the image src to verify it's loaded
    const imgSrc = await img.getAttribute('src');
    console.log('Image src:', imgSrc);
    
    // The src should be a blob URL (created from fetch with credentials)
    expect(imgSrc).toBeTruthy();
    expect(imgSrc?.startsWith('blob:')).toBe(true);
    
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
    const errorMsg = viewer.locator('text=Failed to load');
    await expect(errorMsg).not.toBeVisible();
  });
});
