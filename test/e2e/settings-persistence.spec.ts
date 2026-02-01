import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const USERNAME = 'elfman';
const PASSWORD = 'P2tr3ck!1976';

test.describe('Settings Persistence', () => {

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="username"], input[type="text"]', USERNAME);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
  });

  test('Settings page loads all sections', async ({ page }) => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take screenshot of settings page
    await page.screenshot({ path: 'test-results/settings-overview.png', fullPage: true });

    // Check for settings islands
    const settingsSidebar = page.locator('[data-island="settings-sidebar-island"]');
    const connectionSettings = page.locator('[data-island="connection-settings-island"]');
    const aiProvider = page.locator('[data-island="ai-provider-island"]');

    console.log('Settings sidebar:', await settingsSidebar.count() > 0 ? 'found' : 'not found');
    console.log('Connection settings:', await connectionSettings.count() > 0 ? 'found' : 'not found');
    console.log('AI provider:', await aiProvider.count() > 0 ? 'found' : 'not found');
  });

  test('Session persists across page navigation', async ({ page }) => {
    // Go to dashboard
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    expect(page.url()).not.toContain('/login');
    console.log('Dashboard loaded');

    // Navigate to settings via sidebar
    await page.click('a[href="/settings"]');
    await page.waitForURL('**/settings**', { timeout: 5000 });
    expect(page.url()).toContain('/settings');
    console.log('Settings loaded');

    // Navigate to workspace via sidebar
    await page.click('a[href="/workspace"]');
    await page.waitForLoadState('networkidle');
    console.log('After workspace click URL:', page.url());

    // Should still be logged in (not redirected to login)
    expect(page.url()).not.toContain('/login');

    // Navigate to history via direct URL (workspace has different layout without sidebar)
    await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' });

    // Should still be logged in
    expect(page.url()).toContain('/history');
    expect(page.url()).not.toContain('/login');
    console.log('History loaded');

    // Navigate to dashboard
    await page.click('a[href="/dashboard"]');
    await page.waitForURL('**/dashboard**', { timeout: 5000 });
    expect(page.url()).toContain('/dashboard');

    console.log('Session persisted across navigation - PASSED');
  });

  test('Logout works correctly', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });

    // Click logout
    const logoutLink = page.locator('a[href="/logout"]');
    await logoutLink.click();
    await page.waitForURL('**/login**', { timeout: 5000 });

    // Should be on login page
    expect(page.url()).toContain('/login');

    // Try accessing protected route
    await page.goto(`${BASE}/dashboard`);

    // Should redirect to login
    await page.waitForURL('**/login**', { timeout: 5000 });
    expect(page.url()).toContain('/login');

    console.log('Logout and protection - PASSED');
  });
});
