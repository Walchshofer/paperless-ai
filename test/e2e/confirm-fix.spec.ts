import { test, expect } from '@playwright/test';
import { getTestDocId } from '../helpers/fixtures';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test('confirm SmartMetadataIsland error is resolved', async ({ page }) => {
  const docId = getTestDocId();
  const url = `${BASE_URL}/workspace/doc/${docId}?tab=metadata`;
  
  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Check for the specific error message text
  const errorText = 'Interactive Components Failed to Load';
  const errorPresent = await page.locator(`text=${errorText}`).isVisible();
  expect(errorPresent, 'Error message "Interactive Components Failed to Load" should not be visible').toBe(false);

  // Verify that the island is hydrated and visible
  const smartMetadataRoot = page.locator('[data-testid="smart-metadata-root"]');
  await expect(smartMetadataRoot).toBeVisible({ timeout: 15000 });
  
  // Verify it's hydrated (if it uses that attribute)
  // Based on the code, it uses data-testid="smart-metadata-root"
  
  // Take a screenshot for visual confirmation
  await page.screenshot({ path: 'test-results/fix-confirmation.png', fullPage: true });
  console.log('Screenshot saved to test-results/fix-confirmation.png');
});
