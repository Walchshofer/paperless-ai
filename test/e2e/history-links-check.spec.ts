import { test } from '@playwright/test';

const BASE = 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test('Check history page links', async ({ page }) => {
  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="username"], input[type="text"]', USERNAME);
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });

  // Go to history
  await page.goto(`${BASE}/history`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-page="history"]', { timeout: 20000 });
  await page.waitForSelector('table, [data-testid="history-manager-island"], [data-island="history-manager-island"]', { timeout: 20000 });

  // Get all links on the page
  const allLinks = page.locator('a');
  const linkCount = await allLinks.count();
  console.log(`Total links on history page: ${linkCount}`);

  // Find workspace links
  const workspaceLinks = page.locator('a[href^="/workspace/"]');
  const workspaceLinkCount = await workspaceLinks.count();
  console.log(`Workspace links (/workspace/): ${workspaceLinkCount}`);

  // Find old document links
  const documentLinks = page.locator('a[href^="/document/"]');
  const documentLinkCount = await documentLinks.count();
  console.log(`Old document links (/document/): ${documentLinkCount}`);

  // Log first few of each type
  if (workspaceLinkCount > 0) {
    for (let i = 0; i < Math.min(3, workspaceLinkCount); i++) {
      const href = await workspaceLinks.nth(i).getAttribute('href');
      const text = await workspaceLinks.nth(i).textContent();
      console.log(`  Workspace link ${i + 1}: ${text?.trim()} -> ${href}`);
    }
  }

  if (documentLinkCount > 0) {
    for (let i = 0; i < Math.min(3, documentLinkCount); i++) {
      const href = await documentLinks.nth(i).getAttribute('href');
      const text = await documentLinks.nth(i).textContent();
      console.log(`  OLD Document link ${i + 1}: ${text?.trim()} -> ${href}`);
    }
  }

  // Check for history island
  const historyIsland = page.locator('[data-island="history-manager-island"]');
  if (await historyIsland.count() > 0) {
    console.log('History manager island found');
  } else {
    console.log('No history manager island found');
  }

  // Check for table rows
  const tableRows = page.locator('table tbody tr, .history-row');
  const rowCount = await tableRows.count();
  console.log(`Table rows: ${rowCount}`);

  await page.screenshot({ path: 'test-results/history-links-check.png', fullPage: true });
});
