import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test.describe('Legacy Route Verification', () => {

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="username"], input[type="text"]', USERNAME);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
  });

  test('Legacy routes return 410', async ({ request }) => {
    const manual = await request.get(`${BASE}/manual`);
    const chat = await request.get(`${BASE}/chat`);
    const rag = await request.get(`${BASE}/rag`);

    console.log('Manual status:', manual.status());
    console.log('Chat status:', chat.status());
    console.log('RAG status:', rag.status());
    expect(manual.status()).toBe(410);
    expect(chat.status()).toBe(410);
    expect(rag.status()).toBe(410);
  });

  test('Workspace page structure', async ({ page }) => {
    await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-page=\"document-workspace\"], [data-page=\"workspace\"]', { timeout: 20000 });

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
    await page.goto(`${BASE}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-page=\"history\"]', { timeout: 20000 });

    // Find a document link
    const docLink = page.locator('[data-testid^=\"history-view-\"]').first();

    if (await docLink.count() > 0) {
      const href = await docLink.getAttribute('href');
      console.log('Document link:', href);

      await docLink.click();
      await page.waitForURL('**/workspace/doc/**', { timeout: 20000 });
      await page.waitForSelector('[data-page=\"document-workspace\"]', { timeout: 20000 });

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
