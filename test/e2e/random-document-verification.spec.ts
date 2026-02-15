import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test('visually confirm 5 random documents rendering in viewer', async ({ page }) => {
  // Increase timeout for complex UI interactions
  test.slow();

  // 1. Navigate to a base doc to get the list
  await page.goto(`${BASE_URL}/workspace/doc/74?tab=metadata`, { waitUntil: 'domcontentloaded' });
  
  const viewer = page.locator('[data-testid="overlay-viewer-root"]');
  await expect(viewer).toBeVisible({ timeout: 15000 });

  // 2. Open selector to find all document options
  const trigger = page.locator('[data-testid="document-selector-trigger"]');
  await trigger.click();
  await page.waitForSelector('[data-testid="document-selector-dropdown"]', { timeout: 10000 });

  // Find all options like data-testid="document-option-*"
  const options = page.locator('[data-testid^="document-option-"]');
  const count = await options.count();
  console.log(`Found ${count} documents in the selector.`);

  const allIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const testId = await options.nth(i).getAttribute('data-testid');
    if (testId) {
      const id = testId.replace('document-option-', '');
      allIds.push(id);
    }
  }

  // 3. Select 5 random IDs
  const shuffled = allIds.sort(() => 0.5 - Math.random());
  const selectedIds = shuffled.slice(0, 5);
  console.log(`Verifying documents: ${selectedIds.join(', ')}`);

  // Close the dropdown explicitly by clicking the backdrop if it exists
  const backdrop = page.locator('div.fixed.inset-0.z-40.bg-transparent');
  if (await backdrop.isVisible()) {
    await backdrop.click();
    await expect(backdrop).toBeHidden();
  }

  // 4. Iterate and verify
  for (const id of selectedIds) {
    console.log(`--- Switching to Document ${id} ---`);
    
    // Ensure backdrop is gone
    await expect(backdrop).toBeHidden();

    // Open selector - using force:true to bypass any stray backdrop issues
    await trigger.click({ force: true });
    await page.waitForSelector('[data-testid="document-selector-dropdown"]', { timeout: 10000 });

    const targetOption = page.locator(`[data-testid="document-option-${id}"]`);
    await targetOption.scrollIntoViewIfNeeded();
    
    const title = await targetOption.innerText();
    console.log(`Selecting: ${title.trim()}`);
    
    await targetOption.click();

    // Wait for URL change
    await page.waitForURL(new RegExp(`/workspace/doc/${id}`), { timeout: 15000 });

    // Verify viewer reflects the ID in data-original-url
    // Use toPass to poll for the attribute update from the useEffect
    await expect(async () => {
      const currentUrl = await viewer.getAttribute('data-original-url');
      console.log(`Viewer data-original-url for Doc ${id}: ${currentUrl}`);
      expect(currentUrl).toContain(`/documents/${id}/`);
    }).toPass({ timeout: 10000 });

    // Final screenshot for visual confirmation
    await page.waitForTimeout(2000); // Allow image to render fully
    await page.screenshot({ path: `test-results/random-doc-${id}.png` });
    console.log(`Confirmed Document ${id} rendered correctly.`);
    
    // Check if dropdown is closed after selection (it should be)
    await expect(page.locator('[data-testid="document-selector-dropdown"]')).toBeHidden();
  }

  console.log('All 5 random documents verified successfully.');
});
