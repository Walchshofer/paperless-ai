import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test('verify Document Viewer reactivity when switching documents', async ({ page }) => {
  // Start with Document 74
  const doc1Id = 74;
  const doc2Id = 9;
  
  console.log(`Navigating to document ${doc1Id}`);
  await page.goto(`${BASE_URL}/workspace/doc/${doc1Id}?tab=metadata`, { waitUntil: 'domcontentloaded' });

  const viewer = page.locator('[data-testid="overlay-viewer-root"]');
  await expect(viewer).toBeVisible({ timeout: 15000 });
  
  const initialUrl = await viewer.getAttribute('data-original-url');
  console.log(`Initial document original URL: ${initialUrl}`);
  expect(initialUrl).toContain(String(doc1Id));
  
  await page.screenshot({ path: 'test-results/nav-doc-74.png' });

  // Open the document selector dropdown
  console.log('Opening document selector');
  await page.click('[data-testid="document-selector-trigger"]');
  
  // Search for the other document or find it in the list
  await page.waitForSelector('[data-testid="document-selector-dropdown"]', { timeout: 10000 });
  
  console.log(`Selecting document ${doc2Id}`);
  // Click the option for doc 9 - the data-testid is document-option-${doc.id}
  const option = page.locator(`[data-testid="document-option-${doc2Id}"]`);
  await option.scrollIntoViewIfNeeded();
  await option.click();

  // Wait for the URL to update (inline navigation)
  await page.waitForURL(new RegExp(`/workspace/doc/${doc2Id}`), { timeout: 10000 });
  console.log(`URL updated to doc ${doc2Id}`);

  // Verify the viewer reflects the new document
  // We check the data-original-url attribute which should have been updated by the effect
  await expect(async () => {
    const newUrl = await viewer.getAttribute('data-original-url');
    console.log(`New document original URL: ${newUrl}`);
    expect(newUrl).not.toBe(initialUrl);
    expect(newUrl).toContain(String(doc2Id));
  }).toPass({ timeout: 5000 });

  await page.screenshot({ path: 'test-results/nav-doc-9-updated.png' });
  console.log('Reactivity verified successfully.');
});
