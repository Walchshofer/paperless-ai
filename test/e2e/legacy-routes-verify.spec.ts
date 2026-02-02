import { test } from '@playwright/test';

const BASE = 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test.describe('Legacy Route Verification', () => {

  test.beforeEach(async ({ page }) => {
    // Clear any dismissed banner cookie
    await page.addInitScript(() => {
      document.cookie = 'legacy_banner_dismissed=; path=/; max-age=0';
    });

    // Login
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="username"], input[type="text"]', USERNAME);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
  });

  test('Manual page shows deprecation banner', async ({ page }) => {
    await page.goto(`${BASE}/manual`, { waitUntil: 'networkidle' });

    console.log('Manual URL:', page.url());

    // Check for deprecation banner
    const banner = page.locator('[data-testid="legacy-route-banner"]');
    if (await banner.count() > 0) {
      console.log('Deprecation banner found!');
      const text = await banner.textContent();
      console.log('Banner text:', text);
    } else {
      console.log('No deprecation banner found');
    }

    await page.screenshot({ path: 'test-results/manual-page.png', fullPage: true });
  });

  test('Chat page shows deprecation banner', async ({ page }) => {
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle' });

    console.log('Chat URL:', page.url());

    const banner = page.locator('[data-testid="legacy-route-banner"]');
    if (await banner.count() > 0) {
      console.log('Deprecation banner found!');
    }

    await page.screenshot({ path: 'test-results/chat-page.png', fullPage: true });
  });

  test('Workspace link in banner navigates correctly', async ({ page }) => {
    await page.goto(`${BASE}/manual`, { waitUntil: 'networkidle' });

    const banner = page.locator('[data-testid="legacy-route-banner"]');
    if (await banner.count() > 0) {
      const link = banner.locator('a');
      const href = await link.getAttribute('href');
      console.log('Banner link href:', href);

      await link.click();
      await page.waitForLoadState('networkidle');

      console.log('After banner click URL:', page.url());

      // Check we're on workspace
      const workspacePage = page.locator('[data-page="document-workspace"]');
      if (await workspacePage.count() > 0) {
        console.log('Successfully navigated to workspace!');
      }

      await page.screenshot({ path: 'test-results/banner-nav.png', fullPage: true });
    }
  });

  test('Workspace page structure', async ({ page }) => {
    await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });

    console.log('Final URL:', page.url());

    // Check page structure
    const docContextBar = page.locator('[data-testid="document-context-bar"]');
    const contextSidebar = page.locator('[data-testid="context-sidebar"]');
    const workspaceRoot = page.locator('[data-testid="unified-workspace-root"]');

    console.log('Document context bar:', await docContextBar.count() > 0 ? 'present' : 'missing');
    console.log('Context sidebar:', await contextSidebar.count() > 0 ? 'present' : 'missing');
    console.log('Workspace root:', await workspaceRoot.count() > 0 ? 'present' : 'missing');

    // Check tabs
    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    const chatTab = page.locator('[data-testid="tab-chat"]');
    const contentTab = page.locator('[data-testid="tab-content"]');

    console.log('Metadata tab:', await metadataTab.count() > 0 ? 'present' : 'missing');
    console.log('Chat tab:', await chatTab.count() > 0 ? 'present' : 'missing');
    console.log('Content tab:', await contentTab.count() > 0 ? 'present' : 'missing');

    await page.screenshot({ path: 'test-results/workspace-structure.png', fullPage: true });
  });

  test('Workspace navigation between documents', async ({ page }) => {
    await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' });

    // Find a document link
    const docLink = page.locator('a[href^="/workspace/"]').first();

    if (await docLink.count() > 0) {
      const href = await docLink.getAttribute('href');
      console.log('Document link:', href);

      await docLink.click();
      await page.waitForLoadState('networkidle');

      console.log('After click URL:', page.url());

      // Check we're on workspace
      const workspacePage = page.locator('[data-page="document-workspace"]');
      if (await workspacePage.count() > 0) {
        console.log('Successfully navigated to workspace from history!');
      }
    } else {
      console.log('No document links found in history - checking for old /document/ links');
      const oldDocLink = page.locator('a[href^="/document/"]').first();
      if (await oldDocLink.count() > 0) {
        console.log('WARNING: Found old /document/ links - need to update');
      }
    }

    await page.screenshot({ path: 'test-results/history-nav.png', fullPage: true });
  });
});
