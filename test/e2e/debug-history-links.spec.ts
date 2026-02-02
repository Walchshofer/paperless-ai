import { test } from '@playwright/test';

const BASE = 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test('Debug all links on history page', async ({ page }) => {
  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"], input[type="text"]', USERNAME);
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });

  // Go to history
  await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // Wait for islands to hydrate

  // Get all links
  const allLinks = page.locator('a');
  const linkCount = await allLinks.count();
  console.log(`\nTotal links on history page: ${linkCount}\n`);

  for (let i = 0; i < linkCount; i++) {
    const link = allLinks.nth(i);
    const href = await link.getAttribute('href');
    const text = (await link.textContent())?.trim().substring(0, 50);
    console.log(`Link ${i + 1}: "${text}" -> ${href}`);
  }

  // Check history island for debug info
  const historyIsland = page.locator('[data-island="history-manager-island"]');
  if (await historyIsland.count() > 0) {
    console.log('\nHistory island found, checking row actions...');

    // Check for row action links
    const rowActions = page.locator('.sg-row-actions a, [data-testid*="history-view"], [data-testid*="history-chat"]');
    const actionCount = await rowActions.count();
    console.log(`Row action links found: ${actionCount}`);

    for (let i = 0; i < Math.min(6, actionCount); i++) {
      const href = await rowActions.nth(i).getAttribute('href');
      const testId = await rowActions.nth(i).getAttribute('data-testid');
      console.log(`  Action ${i + 1}: testId=${testId}, href=${href}`);
    }
  }

  // Check all buttons with data-testid containing "history"
  const historyButtons = page.locator('[data-testid*="history"]');
  const btnCount = await historyButtons.count();
  console.log(`\nHistory-related elements with data-testid: ${btnCount}`);

  for (let i = 0; i < btnCount; i++) {
    const el = historyButtons.nth(i);
    const testId = await el.getAttribute('data-testid');
    const tag = await el.evaluate(e => e.tagName);
    console.log(`  Element ${i + 1}: ${tag.toLowerCase()}[data-testid="${testId}"]`);
  }

  await page.screenshot({ path: 'test-results/debug-history.png', fullPage: true });
});
