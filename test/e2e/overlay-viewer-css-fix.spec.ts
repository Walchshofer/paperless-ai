import { test, expect } from '@playwright/test';
import { getTestDocId } from '../helpers/fixtures';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test('verify Document Viewer container is not empty and CSS modules are mapped', async ({ page }) => {
  const docId = getTestDocId();
  const url = `${BASE_URL}/workspace/doc/${docId}?tab=metadata`;
  
  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const viewer = page.locator('[data-testid=\"overlay-viewer-root\"]');
  await expect(viewer).toBeVisible({ timeout: 15000 });
  
  // 1. Check if the container has non-zero height/width (not collapsed)
  const boundingBox = await viewer.boundingBox();
  console.log('Viewer Bounding Box:', boundingBox);
  expect(boundingBox).not.toBeNull();
  expect(boundingBox!.height).toBeGreaterThan(100);
  expect(boundingBox!.width).toBeGreaterThan(100);

  // 2. Check for the presence of the mapped CSS class on the document pane
  const documentPane = page.locator('[data-testid=\"overlay-container\"]').locator('.. ');
  const className = await documentPane.getAttribute('class');
  console.log('Document Pane Class Name:', className);
  
  // The class name should contain the module prefix \"OverlayViewerIsland_documentPane\"
  expect(className).toMatch(/OverlayViewerIsland_documentPane/);
  expect(className).not.toContain('undefined');

  // 3. Verify document image exists in DOM
  const img = page.locator('[data-testid=\"overlay-document-image\"]');
  await expect(img).toBeAttached({ timeout: 10000 });
  
  // 4. Take a screenshot for visual confirmation
  await page.screenshot({ path: 'test-results/viewer-fix-verification.png', fullPage: true });
  console.log('Screenshot saved to test-results/viewer-fix-verification.png');
});
