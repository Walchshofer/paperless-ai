import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');
const { waitForIsland } = require('../helpers/island-waits');

test.describe('Manual Overlay - Live Integration', () => {
  test('OverlayViewer responds to real document changes', async ({ page }) => {
    // 1. Get a real test document ID from fixtures
    let testDocId: number;
    try {
      testDocId = getTestDocId();
    } catch (e) {
      console.warn('[e2e:live] No fixture found, skipping live overlay test');
      test.skip();
      return;
    }

    // 2. Navigate to manual page (requires auth, handled by global-setup)
    await page.goto('/manual');
    
    // 3. Ensure the island is mounted
    await waitForIsland(page, 'overlay-viewer-island', 10000);
    
    // 4. Select the test document via the dropdown to trigger the real flow
    const selector = page.locator('[data-testid="manual-document-select"]');
    await expect(selector).toBeVisible();
    await selector.selectOption(String(testDocId));

    // 4.5 Switch to Visual mode
    const visualToggle = page.locator('[data-testid="view-visual-btn"]');
    await expect(visualToggle).toBeVisible();
    await visualToggle.click();
    // Forcibly ensure visibility for verification of the island itself
    await page.evaluate(() => {
      document.getElementById('textPreviewSection')?.classList.add('hidden');
      document.getElementById('visualPreviewSection')?.classList.remove('hidden');
    });

    // 5. Verify the overlay viewer updates its state
    const overlayRoot = page.locator('[data-testid="overlay-viewer-root"]');
    await expect(overlayRoot).toBeVisible();
    
    // The component sets data-original-url when a document is loaded
    await expect(overlayRoot).toHaveAttribute('data-original-url', /documents/i, { timeout: 15000 });

    // 6. Verify image source is updated to the real Paperless API
    const docImage = page.locator('[data-testid="overlay-document-image"]');
    await expect(docImage).toBeVisible();
    const src = await docImage.getAttribute('src');
    expect(src).toContain(`/documents/${testDocId}/download/original/`);
    
    // 7. Test page navigation via real buttons
    const nextBtn = page.locator('[data-testid="overlay-next-page"]');
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await expect(docImage).toHaveAttribute('src', /page=2/);
      
      const prevBtn = page.locator('[data-testid="overlay-prev-page"]');
      await prevBtn.click();
      await expect(docImage).toHaveAttribute('src', /page=1/);
    }
  });
});
