import { test } from '@playwright/test';

const BASE = 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test.describe('Workspace Expected Behavior', () => {

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="username"], input[type="text"]', USERNAME);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
  });

  test('Clicking Workspace in sidebar - verify behavior', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });

    // Click Workspace link
    const workspaceLink = page.locator('a[href="/workspace"]');
    const href = await workspaceLink.getAttribute('href');
    console.log('Workspace link href:', href);

    await workspaceLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Check final URL
    const finalUrl = page.url();
    console.log('Final URL after clicking Workspace:', finalUrl);

    // Check if document is pre-selected
    const hasDocumentId = /\/workspace\/\d+/.test(finalUrl);
    console.log('Document pre-selected:', hasDocumentId);

    // Take screenshot
    await page.screenshot({ path: 'test-results/workspace-initial-state.png', fullPage: true });

    // Check for document selector dropdown
    const docSelector = page.locator('[data-testid="document-selector"], select, .document-selector, [data-island="document-context-bar-island"]');
    const selectorCount = await docSelector.count();
    console.log('Document selector elements found:', selectorCount);
  });

  test('Check /workspace route directly (without /latest)', async ({ page }) => {
    // Navigate directly to /workspace (not /workspace/latest)
    const response = await page.goto(`${BASE}/workspace`, { waitUntil: 'domcontentloaded' });

    console.log('Response status:', response?.status());
    console.log('Final URL:', page.url());

    // Check if redirected
    const wasRedirected = page.url() !== `${BASE}/workspace`;
    console.log('Was redirected:', wasRedirected);

    await page.screenshot({ path: 'test-results/workspace-direct.png', fullPage: true });
  });
});
