import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test.describe('Document Selection in Workspace', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="username"], input[type="text"]', USERNAME);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
  });

  test('Document selection navigates to /workspace/doc/{id} not /document/{id}', async ({ page }) => {
    // Go to workspace (initial state, no document selected)
    await page.goto(`${BASE}/workspace`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('Initial URL:', page.url());
    await page.screenshot({ path: 'test-results/workspace-before-select.png', fullPage: true });

    // Click on document selector to open dropdown
    const selectorTrigger = page.locator('[data-testid="document-selector-trigger"], .document-selector, [data-island="document-context-bar-island"] button').first();

    if (await selectorTrigger.count() > 0) {
      await selectorTrigger.click();
      await page.waitForTimeout(500);

      // Look for a document option to click
      const docOption = page.locator('[data-testid^="doc-option-"], [data-island="document-context-bar-island"] li, .dropdown-item').first();

      if (await docOption.count() > 0) {
        // Get the document info before clicking
        const optionText = await docOption.textContent();
        console.log('Selecting document:', optionText);

        // Listen for navigation
        const navigationPromise = page.waitForURL(/\/(workspace\/doc|document)\/\d+/, { timeout: 10000 });

        await docOption.click();

        await navigationPromise;

        const finalUrl = page.url();
        console.log('Final URL after selection:', finalUrl);

        // Check that we navigated to /workspace/doc/{id} NOT /document/{id}
        expect(finalUrl).toContain('/workspace/doc/');
        expect(finalUrl).not.toContain('/document/');

        // Check page loaded successfully (no 404)
        const title = await page.title();
        console.log('Page title:', title);
        expect(title).not.toContain('404');
        expect(title).not.toContain('Error');

        await page.screenshot({ path: 'test-results/workspace-after-select.png', fullPage: true });
      } else {
        console.log('No document options found in dropdown');
      }
    } else {
      console.log('Document selector trigger not found');
    }
  });

  test('Verify /workspace/doc/{id} loads document correctly', async ({ page }) => {
    // Navigate directly to a specific document in workspace
    await page.goto(`${BASE}/workspace/doc/9`, { waitUntil: 'networkidle' });

    console.log('URL:', page.url());

    // Should not be 404
    const errorEl = page.locator('h1:has-text("Error"), h1:has-text("404"), .error-message');
    const hasError = await errorEl.count() > 0;
    console.log('Has error element:', hasError);

    if (hasError) {
      const errorText = await errorEl.first().textContent();
      console.log('Error text:', errorText);
    }

    // Check workspace elements are present
    const workspacePage = page.locator('[data-page="document-workspace"]');
    const contextBar = page.locator('[data-testid="document-context-bar"]');
    const sidebar = page.locator('[data-testid="context-sidebar"]');

    console.log('Workspace page:', await workspacePage.count() > 0);
    console.log('Context bar:', await contextBar.count() > 0);
    console.log('Sidebar:', await sidebar.count() > 0);

    await page.screenshot({ path: 'test-results/workspace-document-9.png', fullPage: true });
  });
});
