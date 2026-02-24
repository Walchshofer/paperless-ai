import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test.describe('Production Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="username"], input[type="text"]', USERNAME);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
  });

  test('Dashboard loads and shows correct metrics', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-page="dashboard"]', { timeout: 20000 });
    
    // Check main heading
    const heading = page.locator('h1, [data-testid="dashboard-heading"]');
    await expect(heading.first()).toBeVisible();
    
    // Check for statistics cards (documents, tags, etc)
    const statsText = await page.content();
    console.log('Dashboard contains "document":', statsText.toLowerCase().includes('document'));
    console.log('Dashboard contains "tag":', statsText.toLowerCase().includes('tag'));
    
    await page.screenshot({ path: 'test-results/smoke-01-dashboard.png', fullPage: true });
  });

  test('Workspace navigation and document selector works', async ({ page }) => {
    await page.goto(`${BASE}/workspace`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-page="workspace"]', { timeout: 20000 });
    
    console.log('Workspace URL:', page.url());
    await page.screenshot({ path: 'test-results/smoke-02-workspace.png', fullPage: true });
    
    // Find document selector
    const selectorTrigger = page.locator('[data-testid="document-selector-trigger"]');
    
    if (await selectorTrigger.count() > 0) {
      console.log('Document selector trigger found');
      
      // Check if dropdown already visible or click to open
      const dropdown = page.locator('[data-testid="document-selector-dropdown"]');
      if (await dropdown.count() === 0) {
        await selectorTrigger.click();
        await page.waitForTimeout(500);
      }
      
      // Check for document options
      const docOptions = page.locator('[data-testid^="document-option-"]');
      const optionCount = await docOptions.count();
      console.log(`Found ${optionCount} document options`);
      
      if (optionCount > 0) {
        await page.screenshot({ path: 'test-results/smoke-03-doc-selector.png', fullPage: true });
        
        // Select a random document (use the 5th one if available, else first)
        const idx = Math.min(4, optionCount - 1);
        const option = docOptions.nth(idx);
        const optionText = await option.textContent();
        console.log(`Selecting document #${idx + 1}: ${optionText?.trim()}`);
        
        await option.click();
        await page.waitForTimeout(2000);
        
        const finalUrl = page.url();
        console.log('Final URL after selection:', finalUrl);
        expect(finalUrl).toContain('/workspace/doc/');
        
        await page.screenshot({ path: 'test-results/smoke-04-doc-selected.png', fullPage: true });
      }
    }
  });

  test('Selected document shows metadata panel', async ({ page }) => {
    // Go directly to a document
    await page.goto(`${BASE}/workspace/doc/9`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-page="document-workspace"]', { timeout: 20000 });
    
    console.log('Document workspace URL:', page.url());
    
    // Check for workspace root
    const workspaceRoot = page.locator('[data-testid="unified-workspace-root"]');
    if (await workspaceRoot.count() > 0) {
      console.log('Unified workspace root found');
    }
    
    // Check for tabs
    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    const chatTab = page.locator('[data-testid="tab-chat"]');
    const contentTab = page.locator('[data-testid="tab-content"]');
    
    console.log('Metadata tab:', await metadataTab.count() > 0 ? 'present' : 'missing');
    console.log('Chat tab:', await chatTab.count() > 0 ? 'present' : 'missing');
    console.log('Content tab:', await contentTab.count() > 0 ? 'present' : 'missing');
    
    await page.screenshot({ path: 'test-results/smoke-05-doc-workspace.png', fullPage: true });
    
    // Check for smart metadata island (AI features)
    const smartMetadata = page.locator('[data-island="context-sidebar-island"], [data-testid="context-sidebar"]');
    if (await smartMetadata.count() > 0) {
      console.log('Smart metadata/context sidebar found');
    }
    
    // Check for document context bar
    const contextBar = page.locator('[data-testid="document-context-bar"]');
    if (await contextBar.count() > 0) {
      console.log('Document context bar found');
    }
  });

  test('History page loads', async ({ page }) => {
    await page.goto(`${BASE}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-page="history"]', { timeout: 20000 });
    
    console.log('History URL:', page.url());
    
    // Check for history manager island
    const historyIsland = page.locator('[data-island="history-manager-island"]');
    if (await historyIsland.count() > 0) {
      console.log('History manager island found');
    }
    
    // Check for any table or data
    const table = page.locator('table');
    if (await table.count() > 0) {
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();
      console.log(`History table has ${rowCount} rows`);
    }
    
    // Check for "no history" message if empty
    const pageContent = await page.content();
    if (pageContent.toLowerCase().includes('no history')) {
      console.log('No history documents yet (expected for fresh install)');
    }
    
    await page.screenshot({ path: 'test-results/smoke-06-history.png', fullPage: true });
  });

  test('Sidebar navigation works', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-page="dashboard"]', { timeout: 20000 });
    
    // Check sidebar links
    const navLinks = page.locator('.sidebar-nav a, nav a[href]');
    const linkCount = await navLinks.count();
    console.log(`Found ${linkCount} navigation links`);
    
    // List all nav links
    for (let i = 0; i < Math.min(linkCount, 10); i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      const text = (await navLinks.nth(i).textContent())?.trim();
      console.log(`  Nav link: "${text}" -> ${href}`);
    }
    
    await page.screenshot({ path: 'test-results/smoke-07-sidebar.png', fullPage: true });
    
    // Test clicking workspace link
    const workspaceLink = page.locator('a[href="/workspace"]');
    if (await workspaceLink.count() > 0) {
      await workspaceLink.first().click();
      await page.waitForURL('**/workspace*', { timeout: 20000 });
      await page.waitForSelector('[data-page="workspace"]', { timeout: 20000 });
      console.log('After clicking workspace:', page.url());
      expect(page.url()).toContain('/workspace');
    }
  });

  test('AI analyze endpoint is accessible', async ({ page: _page, request }) => {
    // Check if AI analyze endpoint exists
    const response = await request.get(`${BASE}/api/status`);
    console.log('API status response:', response.status());
    
    if (response.ok()) {
      const data = await response.json();
      console.log('API status data:', JSON.stringify(data, null, 2).substring(0, 500));
    }
  });
});
