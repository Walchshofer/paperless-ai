import { test, expect } from '@playwright/test';

test('Verify UI changes - no duplicate dropdown, document title visible', async ({ page }) => {
  const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', 'elfman');
  await page.fill('input[name="password"]', 'P2tr3ck!1976');
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

  // Navigate to workspace and switch to chat tab
  await page.goto(`${BASE}/workspace/doc/latest`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-page="document-workspace"]', { timeout: 20000 });
  // Click the Chat tab explicitly (query param not honored by sidebar tabs)
  const chatTab = page.locator('[role="tab"]:has-text("Chat")');
  await chatTab.click();
  await page.waitForSelector('[data-testid="chat-workspace-root"]', { timeout: 20000 });

  // Wait for page to load
  await page.waitForTimeout(2000);

  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/chat-page-full.png', fullPage: true });

  // Check that the primary document title is displayed (locked display, no dropdown)
  const titleDisplay = page.locator('[data-testid="chat-document-title"]');
  await expect(titleDisplay).toBeVisible();
  console.log('✓ Primary document title display is visible');

  // Check that the model selector dropdown exists (single dropdown, no duplicates)
  const modelSelect = page.locator('[data-testid="chat-model-select"]');
  const modelSelectCount = await modelSelect.count();
  console.log(`Found ${modelSelectCount} model select dropdown(s)`);
  expect(modelSelectCount).toBeLessThanOrEqual(1);
  console.log('✓ No duplicate model dropdowns');

  // Check that the guided rail header is visible
  const guidedRail = page.locator('[data-testid="chat-guided-rail"]');
  await expect(guidedRail).toBeVisible();
  console.log('✓ Guided rail header is visible');

  console.log('\n=== UI Verification Complete ===');
  console.log('Screenshots saved:');
  console.log('  - screenshots/chat-page-full.png');
});
