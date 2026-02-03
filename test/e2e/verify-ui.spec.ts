import { test, expect } from '@playwright/test';

test('Verify UI changes - no duplicate dropdown, document title visible', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="username"]', 'elfman');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/chat');

  // Wait for page to load
  await page.waitForTimeout(2000);

  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/chat-page-full.png', fullPage: true });

  // Check that there's only ONE document dropdown in the main workspace (dropdown #1)
  const mainDropdown = page.locator('#chat-document-select');
  await expect(mainDropdown).toBeVisible();
  console.log('✓ Main document dropdown (#1) is visible');

  // Check that there's NO duplicate dropdown in the sidebar (the old #2 should be gone)
  const sidebarDropdowns = page.locator('.sidebar-content select[data-testid*="document"]');
  const sidebarDropdownCount = await sidebarDropdowns.count();
  console.log(`Found ${sidebarDropdownCount} dropdown(s) in sidebar`);
  expect(sidebarDropdownCount).toBe(0);
  console.log('✓ No duplicate dropdowns in sidebar');

  // Check that the document title display is visible in the sidebar
  const titleDisplay = page.locator('[data-testid="chat-document-title"]');
  const titleCount = await titleDisplay.count();
  console.log(`Found ${titleCount} document title display(s)`);
  expect(titleCount).toBeGreaterThan(0);
  console.log('✓ Document title display (#3) is visible');

  // Take screenshot of the sidebar area
  const sidebar = page.locator('.sidebar-content');
  await sidebar.screenshot({ path: 'screenshots/sidebar-area.png' });

  console.log('\n=== UI Verification Complete ===');
  console.log('Screenshots saved:');
  console.log('  - screenshots/chat-page-full.png');
  console.log('  - screenshots/sidebar-area.png');
});
