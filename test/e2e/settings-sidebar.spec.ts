import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('SettingsSidebarIsland smoke test', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto(`${BASE}/settings`);
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('sidebar mounts and displays all default categories', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });

    // Wait for sidebar island to mount
    await page.waitForSelector('[data-island="settings-sidebar-island"][data-mounted="true"]', { timeout: 10000 });

    // Verify sidebar header
    await expect(page.locator('[data-testid="settings-sidebar-root"] >> text=Settings')).toBeVisible();

    // Verify default categories are visible
    await expect(page.locator('[data-testid="category-overview"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-connection"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-ai-provider"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-expert-models"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-advanced"]')).toBeVisible();

    // Verify developer category is NOT visible initially
    await expect(page.locator('[data-testid="category-developer"]')).not.toBeVisible();

    // Verify developer mode toggle is visible
    await expect(page.locator('[data-testid="developer-toggle"]')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-settings-sidebar/screenshot-initial.png',
      fullPage: true
    });

    // Assert no console errors
    expect(consoleErrors, 'no console errors during run').toEqual([]);
  });

  test('developer mode toggle shows/hides developer category and persists to localStorage', async ({ page }) => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="settings-sidebar-island"][data-mounted="true"]', { timeout: 10000 });

    // Developer category should not be visible initially
    await expect(page.locator('[data-testid="category-developer"]')).not.toBeVisible();

    // Click developer toggle
    await page.click('[data-testid="developer-toggle"]');
    await page.waitForTimeout(200);

    // Developer category should now be visible
    await expect(page.locator('[data-testid="category-developer"]')).toBeVisible();

    // Verify localStorage was updated
    const developerMode = await page.evaluate(() => {
      return localStorage.getItem('settings:developerMode');
    });
    expect(developerMode).toBe('true');

    // Take screenshot with developer mode enabled
    await page.screenshot({
      path: 'test-results/playwright-settings-sidebar/screenshot-developer-enabled.png',
      fullPage: true
    });

    // Reload page to verify persistence
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="settings-sidebar-island"][data-mounted="true"]', { timeout: 10000 });

    // Developer category should still be visible after reload
    await expect(page.locator('[data-testid="category-developer"]')).toBeVisible();

    // Toggle off
    await page.click('[data-testid="developer-toggle"]');
    await page.waitForTimeout(200);

    // Developer category should be hidden again
    await expect(page.locator('[data-testid="category-developer"]')).not.toBeVisible();

    // Verify localStorage was updated
    const developerModeAfter = await page.evaluate(() => {
      return localStorage.getItem('settings:developerMode');
    });
    expect(developerModeAfter).toBe('false');
  });

  test('category navigation updates active state and URL hash', async ({ page }) => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="settings-sidebar-island"][data-mounted="true"]', { timeout: 10000 });

    // Overview should be active by default
    await expect(page.locator('[data-testid="category-overview"]')).toHaveClass(/bg-blue-100/);

    // Click on Connection category
    await page.click('[data-testid="category-connection"]');
    await page.waitForTimeout(200);

    // Connection should be active
    await expect(page.locator('[data-testid="category-connection"]')).toHaveClass(/bg-blue-100/);

    // URL hash should be updated
    expect(page.url()).toContain('#connection');

    // Verify localStorage was updated
    const lastCategory = await page.evaluate(() => {
      return localStorage.getItem('settings:lastCategory');
    });
    expect(lastCategory).toBe('connection');

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-settings-sidebar/screenshot-connection-active.png',
      fullPage: true
    });

    // Click on AI Provider category
    await page.click('[data-testid="category-ai-provider"]');
    await page.waitForTimeout(200);

    // AI Provider should be active
    await expect(page.locator('[data-testid="category-ai-provider"]')).toHaveClass(/bg-blue-100/);

    // URL hash should be updated
    expect(page.url()).toContain('#ai-provider');
  });

  test('hash navigation updates active category', async ({ page }) => {
    // Navigate directly with hash
    await page.goto(`${BASE}/settings#expert-models`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="settings-sidebar-island"][data-mounted="true"]', { timeout: 10000 });

    // Expert Models should be active
    await expect(page.locator('[data-testid="category-expert-models"]')).toHaveClass(/bg-blue-100/);

    // Change hash programmatically
    await page.evaluate(() => {
      window.location.hash = 'advanced';
    });
    await page.waitForTimeout(200);

    // Advanced should be active
    await expect(page.locator('[data-testid="category-advanced"]')).toHaveClass(/bg-blue-100/);
  });
});
