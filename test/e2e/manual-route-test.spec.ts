import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test.describe('Manual Route Testing', () => {

  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });

    // Fill login form
    await page.fill('input[name="username"], input[type="text"]', USERNAME);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);

    // Submit
    await page.click('button[type="submit"], input[type="submit"]');

    // Wait for redirect after login
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
  });

  test('Dashboard loads correctly', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });

    // Check page loaded
    await expect(page).toHaveTitle(/Dashboard|Paperless/i);

    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard.png', fullPage: true });

    console.log('Dashboard URL:', page.url());
  });

  test('Workspace link navigates correctly', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });

    // Find workspace link in sidebar
    const workspaceLink = page.locator('a:has-text("Workspace")').first();

    if (await workspaceLink.count() > 0) {
      const href = await workspaceLink.getAttribute('href');
      console.log('Workspace link href:', href);

      await workspaceLink.click();
      await page.waitForLoadState('domcontentloaded');

      console.log('After click URL:', page.url());
      await page.screenshot({ path: 'test-results/workspace-nav.png', fullPage: true });
    } else {
      console.log('No Workspace link found');
    }
  });

  test('Workspace/latest route works', async ({ page }) => {
    const response = await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'domcontentloaded' });

    console.log('Response status:', response?.status());
    console.log('Final URL:', page.url());

    await page.screenshot({ path: 'test-results/workspace-latest.png', fullPage: true });

    // Check for error page
    const errorEl = page.locator('[data-testid="error-message"], .error, h1:has-text("Error")').first();
    if (await errorEl.count() > 0) {
      console.log('Error found:', await errorEl.textContent());
    }

    // Check for workspace page indicators
    const workspaceEl = page.locator('[data-page="document-workspace"]');
    if (await workspaceEl.count() > 0) {
      console.log('Workspace page found!');
    }
  });

  test('History page loads', async ({ page }) => {
    await page.goto(`${BASE}/history`, { waitUntil: 'domcontentloaded' });

    console.log('History URL:', page.url());
    await page.screenshot({ path: 'test-results/history.png', fullPage: true });

    // Check for history table or content
    const historyTable = page.locator('table, [data-testid="history-manager-island"]');
    if (await historyTable.count() > 0) {
      console.log('History table found');
    }
  });

  test('Settings page loads', async ({ page }) => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });

    console.log('Settings URL:', page.url());
    await page.screenshot({ path: 'test-results/settings.png', fullPage: true });
  });

  test('Check all sidebar links', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });

    // Get all sidebar links
    const sidebarLinks = page.locator('nav a, aside a, .sidebar a');
    const count = await sidebarLinks.count();

    console.log(`Found ${count} sidebar links`);

    for (let i = 0; i < count && i < 10; i++) {
      const link = sidebarLinks.nth(i);
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      console.log(`Link ${i + 1}: ${text?.trim()} -> ${href}`);
    }
  });
});
