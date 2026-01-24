import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('Settings Phase 2 Integration Tests', () => {
  test('restart banner appears when settings require restart', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Restart banner should be mounted but not visible initially
    await page.waitForSelector('[data-island="restart-banner-island"][data-mounted="true"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="restart-banner"]')).not.toBeVisible();

    // Intercept save API call
    await page.route('**/settings/apply', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          requiresRestart: true
        })
      });
    });

    // Make a change and save (which triggers restart-required event)
    await page.fill('[data-testid="api-url-input"]', 'http://localhost:8000');
    await page.fill('[data-testid="api-token-input"]', 'test-token');
    await page.click('[data-testid="save-button"]');

    // Wait for save to complete
    await page.waitForTimeout(500);

    // Restart banner should now be visible
    await expect(page.locator('[data-testid="restart-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="restart-message"]')).toContainText('Restart Required');
    await expect(page.locator('[data-testid="changed-settings"]')).toContainText('Connection');

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-integration/screenshot-restart-banner-visible.png',
      fullPage: true
    });
  });

  test('restart banner persists across navigation', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });
    await page.waitForSelector('[data-island="restart-banner-island"][data-mounted="true"]', { timeout: 10000 });

    // Intercept save API call
    await page.route('**/settings/apply', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, requiresRestart: true })
      });
    });

    // Make a change and save
    await page.fill('[data-testid="api-url-input"]', 'http://localhost:8000');
    await page.fill('[data-testid="api-token-input"]', 'test-token');
    await page.click('[data-testid="save-button"]');
    await page.waitForTimeout(500);

    // Verify banner is visible
    await expect(page.locator('[data-testid="restart-banner"]')).toBeVisible();

    // Navigate to different category
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="ai-provider-island"][data-mounted="true"]', { timeout: 10000 });

    // Banner should still be visible
    await expect(page.locator('[data-testid="restart-banner"]')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-integration/screenshot-banner-persists.png',
      fullPage: true
    });
  });

  test('restart banner can be dismissed', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });
    await page.waitForSelector('[data-island="restart-banner-island"][data-mounted="true"]', { timeout: 10000 });

    // Intercept save API call
    await page.route('**/settings/apply', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, requiresRestart: true })
      });
    });

    // Trigger restart banner
    await page.fill('[data-testid="api-url-input"]', 'http://localhost:8000');
    await page.fill('[data-testid="api-token-input"]', 'test-token');
    await page.click('[data-testid="save-button"]');
    await page.waitForTimeout(500);

    // Verify banner is visible
    await expect(page.locator('[data-testid="restart-banner"]')).toBeVisible();

    // Click dismiss button
    await page.click('[data-testid="dismiss-button"]');

    // Banner should be hidden
    await expect(page.locator('[data-testid="restart-banner"]')).not.toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-integration/screenshot-banner-dismissed.png',
      fullPage: true
    });
  });

  test('restart banner accumulates multiple changes', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });
    await page.waitForSelector('[data-island="restart-banner-island"][data-mounted="true"]', { timeout: 10000 });

    // Intercept save API calls
    await page.route('**/settings/apply', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, requiresRestart: true })
      });
    });

    // First change - connection settings
    await page.fill('[data-testid="api-url-input"]', 'http://localhost:8000');
    await page.fill('[data-testid="api-token-input"]', 'test-token');
    await page.click('[data-testid="save-button"]');
    await page.waitForTimeout(500);

    // Navigate to AI Provider
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="ai-provider-island"][data-mounted="true"]', { timeout: 10000 });

    // Second change - AI provider
    await page.selectOption('[data-testid="provider-select"]', 'ollama');
    await page.waitForTimeout(100);
    await page.click('[data-testid="save-button"]');
    await page.waitForTimeout(500);

    // Banner should show accumulated changes
    await expect(page.locator('[data-testid="restart-banner"]')).toBeVisible();
    const changedSettingsText = await page.locator('[data-testid="changed-settings"]').textContent();
    expect(changedSettingsText).toContain('API');
    expect(changedSettingsText).toContain('Connection');

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-integration/screenshot-banner-accumulated.png',
      fullPage: true
    });
  });

  test('sidebar navigation works without data loss', async ({ page }) => {
    await page.goto(`${BASE}/settings#overview`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="settings-sidebar-island"][data-mounted="true"]', { timeout: 10000 });

    // Navigate through sidebar
    await page.click('[data-testid="nav-connection"]');
    await expect(page.locator('[data-island="connection-settings-island"]')).toBeVisible();

    await page.click('[data-testid="nav-ai-provider"]');
    await expect(page.locator('[data-island="ai-provider-island"]')).toBeVisible();

    await page.click('[data-testid="nav-expert-models"]');
    await expect(page.locator('[data-island="expert-models-island"]')).toBeVisible();

    await page.click('[data-testid="nav-overview"]');
    await expect(page.locator('[data-island="overview-dashboard-island"]')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-integration/screenshot-sidebar-navigation.png',
      fullPage: true
    });
  });

  test('connection test button works', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Intercept test connection API call
    await page.route('**/api/settings/test-connection', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Connection successful!'
        })
      });
    });

    // Fill in connection details
    await page.fill('[data-testid="api-url-input"]', 'http://localhost:8000');
    await page.fill('[data-testid="api-token-input"]', 'test-token');

    // Test connection
    await page.click('[data-testid="test-connection-button"]');

    // Verify loading state
    await expect(page.locator('[data-testid="test-connection-button"]')).toHaveText('Testing...');

    // Wait for completion
    await page.waitForTimeout(400);

    // Verify success message
    await expect(page.locator('[data-testid="test-result"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-result"]')).toContainText('Connection successful');

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-integration/screenshot-connection-test.png',
      fullPage: true
    });
  });

  test('all Phase 2 islands mount correctly on settings page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });

    // Wait for all Phase 2 islands to mount
    await page.waitForSelector('[data-island="overview-dashboard-island"][data-mounted="true"]', { timeout: 10000 });
    await page.waitForSelector('[data-island="settings-sidebar-island"][data-mounted="true"]', { timeout: 10000 });
    await page.waitForSelector('[data-island="restart-banner-island"][data-mounted="true"]', { timeout: 10000 });

    // Verify core islands are present
    await expect(page.locator('[data-island="overview-dashboard-island"]')).toBeVisible();
    await expect(page.locator('[data-island="settings-sidebar-island"]')).toBeVisible();

    // Navigate to each category and verify island mounts
    await page.click('[data-testid="nav-connection"]');
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });

    await page.click('[data-testid="nav-ai-provider"]');
    await page.waitForSelector('[data-island="ai-provider-island"][data-mounted="true"]', { timeout: 10000 });

    await page.click('[data-testid="nav-expert-models"]');
    await page.waitForSelector('[data-island="expert-models-island"][data-mounted="true"]', { timeout: 10000 });

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-integration/screenshot-all-islands-mounted.png',
      fullPage: true
    });

    // Assert no console errors
    expect(consoleErrors, 'no console errors during island mounting').toEqual([]);
  });

  test('events flow correctly between islands', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });
    await page.waitForSelector('[data-island="restart-banner-island"][data-mounted="true"]', { timeout: 10000 });

    // Track events
    const events: string[] = [];
    await page.exposeFunction('logEvent', (eventName: string) => {
      events.push(eventName);
    });

    await page.evaluate(() => {
      document.addEventListener('settings:changed', () => {
        (window as any).logEvent('settings:changed');
      });
      document.addEventListener('settings:restart-required', () => {
        (window as any).logEvent('settings:restart-required');
      });
      document.addEventListener('settings:saved', () => {
        (window as any).logEvent('settings:saved');
      });
    });

    // Intercept save API call
    await page.route('**/settings/apply', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, requiresRestart: true })
      });
    });

    // Make a change and save
    await page.fill('[data-testid="api-url-input"]', 'http://localhost:8000');
    await page.fill('[data-testid="api-token-input"]', 'test-token');
    await page.click('[data-testid="save-button"]');
    await page.waitForTimeout(500);

    // Verify all events were dispatched
    expect(events).toContain('settings:changed');
    expect(events).toContain('settings:restart-required');
    expect(events).toContain('settings:saved');

    // Verify restart banner responded to event
    await expect(page.locator('[data-testid="restart-banner"]')).toBeVisible();
  });
});
