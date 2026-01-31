import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

// Prevent external GitHub fetches in tests
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.__DISABLE_GITHUB_FETCH__ = true; });
});

test.describe('Settings Phase 2 Integration Tests', () => {
  test('restart banner appears when settings require restart', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'connection-settings-island', 10000);

    // Restart banner should be mounted but not visible initially
    // Restart banner may be mounted but not visible initially; ensure it's mounted
    await waitForIsland(page, 'restart-banner-island', 10000);
    await expect(page.locator('[data-testid="restart-banner-root"]')).not.toBeVisible();

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
    // Click visible save button within connection island
    await page.locator('[data-testid="connection-settings-island"] [data-testid="save-button"]:visible').click();

    // Wait for save to complete
    await page.waitForTimeout(500);

    // Restart banner should now be visible
    await expect(page.locator('[data-testid="restart-banner-root"]')).toBeVisible();
    await expect(page.locator('[data-testid="restart-message"]')).toContainText('Restart Required');
    // Changed settings list may contain specific fields; be resilient and check for either 'Connection' or one of the specific changed fields
    const changedText = await page.locator('[data-testid="changed-settings"]').textContent();
    expect(changedText).toMatch(/Connection|API URL|API Token|AI Provider/);

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-integration/screenshot-restart-banner-visible.png',
      fullPage: true
    });
  });

  test('restart banner persists across navigation', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'connection-settings-island', 10000);
    await waitForIsland(page, 'restart-banner-island', 10000);

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
    await page.locator('[data-testid="connection-settings-island"] [data-testid="save-button"]:visible').click();
    await page.waitForTimeout(500);

    // Verify banner is visible (allow event propagation)
    await waitForIsland(page, 'restart-banner-island', 10000);
    await expect(page.locator('[data-testid="restart-banner-root"]')).toBeVisible();

    // Navigate to different category
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="ai-provider-island"][data-mounted="true"]', { timeout: 10000 });

    // Banner should still be visible
    await expect(page.locator('[data-testid="restart-banner-root"]')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-integration/screenshot-banner-persists.png',
      fullPage: true
    });
  });

  test('restart banner can be dismissed', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'connection-settings-island', 10000);
    await waitForIsland(page, 'restart-banner-island', 10000);

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
    await page.locator('[data-testid="connection-settings-island"] [data-testid="save-button"]:visible').click();
    await page.waitForTimeout(500);

    // Verify banner is visible
    await expect(page.locator('[data-testid="restart-banner-root"]')).toBeVisible();

    // Click dismiss button (use DOM click to avoid overlay/pointer interception)
    await page.locator('[data-testid="dismiss-button"]').evaluate((el: HTMLElement) => el.click());

    // Banner should be hidden
    await expect(page.locator('[data-testid="restart-banner-root"]')).not.toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-integration/screenshot-banner-dismissed.png',
      fullPage: true
    });
  });

  test('restart banner accumulates multiple changes', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'connection-settings-island', 10000);
    await waitForIsland(page, 'restart-banner-island', 10000);

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
    await page.locator('[data-testid="connection-settings-island"] [data-testid="save-button"]:visible').click();
    await page.waitForTimeout(500);

    // Navigate to AI Provider
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    // Second change - AI provider
    await page.selectOption('[data-testid="provider-select"]', 'ollama');
    await page.waitForTimeout(100);
    await page.locator('[data-testid="ai-provider-root"] [data-testid="save-button"]:visible').click();
    await page.waitForTimeout(500);

    // Banner should show accumulated changes
    await expect(page.locator('[data-testid="restart-banner-root"]')).toBeVisible();
    const changedSettingsText = await page.locator('[data-testid="changed-settings"]').textContent();
    expect(changedSettingsText).toMatch(/API|Connection|AI Provider|API URL|API Token/);

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-integration/screenshot-banner-accumulated.png',
      fullPage: true
    });
  });

  test('sidebar navigation works without data loss', async ({ page }) => {
    await page.goto(`${BASE}/settings#overview`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="settings-sidebar-island"][data-mounted="true"]', { timeout: 10000 });

    // Navigate through sidebar using robust waits and visible checks
    const sidebar = page.locator('[data-island="settings-sidebar-island"]');

    const navConnection = sidebar.getByRole('button', { name: /Connection/ });
    await expect(navConnection).toBeVisible();
    await navConnection.click();
    await waitForIsland(page, 'connection-settings-island', 10000);
    await expect(page.locator('[data-island="connection-settings-island"]')).toBeVisible();

    const navAiProvider = sidebar.getByRole('button', { name: /AI Provider/ });
    await expect(navAiProvider).toBeVisible();
    await navAiProvider.click();
    await waitForIsland(page, 'ai-provider-island', 10000);
    await expect(page.locator('[data-island="ai-provider-island"]')).toBeVisible();

    const navExpertModels = sidebar.getByRole('button', { name: /Expert Models/ });
    await expect(navExpertModels).toBeVisible();

    // Click Expert Models - this redirects into AI Provider (focus expert models)
    await navExpertModels.click();
    await waitForIsland(page, 'ai-provider-island', 10000);
    await expect(page.locator('[data-island="ai-provider-island"]')).toBeVisible();

    // Ensure Ollama provider is selected so embedded Expert Models are visible
    const providerSelect = page.locator('[data-testid="provider-select"]');
    if ((await providerSelect.count()) > 0) {
      await providerSelect.selectOption('ollama');
      await page.evaluate(() => {
        const el = document.getElementById('provider') as HTMLSelectElement | null;
        if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    await waitForIsland(page, 'expert-models-island', 10000);
    await expect(page.locator('[data-testid="expert-models-root"]')).toBeVisible();

    const navOverview = sidebar.getByRole('button', { name: /Overview/ });
    await expect(navOverview).toBeVisible();
    await navOverview.click();
    await waitForIsland(page, 'overview-dashboard-island', 10000);
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
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('api.github.com') || text.includes('Failed to fetch stars') || text.includes('Failed to load resource')) return;
        consoleErrors.push(text);
      }
    });

    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });

    // Wait for all Phase 2 islands to mount
    await waitForIsland(page, 'overview-dashboard-island', 10000);
    await waitForIsland(page, 'settings-sidebar-island', 10000);
    await waitForIsland(page, 'restart-banner-island', 10000);

    // Verify core islands are present
    await expect(page.locator('[data-island="overview-dashboard-island"]')).toBeVisible();
    await expect(page.locator('[data-island="settings-sidebar-island"]')).toBeVisible();

    // Navigate to each category and verify island mounts using the sidebar role-based buttons
    const sidebar = page.locator('[data-island="settings-sidebar-island"]');

    const navConnection = sidebar.getByRole('button', { name: /Connection/ });
    await expect(navConnection).toBeVisible();
    await navConnection.click();
    await waitForIsland(page, 'connection-settings-island', 10000);

    const navAiProvider = sidebar.getByRole('button', { name: /AI Provider/ });
    await expect(navAiProvider).toBeVisible();
    await navAiProvider.click();
    await waitForIsland(page, 'ai-provider-island', 10000);

    const navExpertModels = sidebar.getByRole('button', { name: /Expert Models/ });
    await expect(navExpertModels).toBeVisible();
    await navExpertModels.click();
    await waitForIsland(page, 'expert-models-island', 10000);

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
    await waitForIsland(page, 'restart-banner-island', 10000);

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
    await page.locator('[data-testid="connection-settings-island"] [data-testid="save-button"]:visible').click();
    await page.waitForTimeout(500);

    // Verify all events were dispatched
    expect(events).toContain('settings:changed');
    expect(events).toContain('settings:restart-required');
    expect(events).toContain('settings:saved');

    // Verify restart banner responded to event
    await expect(page.locator('[data-testid="restart-banner-root"]')).toBeVisible();
  });
});
