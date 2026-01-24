import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('ConnectionSettingsIsland smoke test', () => {
  test('island mounts and displays all connection fields', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });

    // Wait for connection settings island to mount
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Verify heading
    await expect(page.locator('[data-testid="connection-settings-root"] >> text=Connection Settings')).toBeVisible();

    // Verify all form fields are present
    await expect(page.locator('[data-testid="api-url-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-token-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="username-input"]')).toBeVisible();

    // Verify buttons are present
    await expect(page.locator('[data-testid="test-connection-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-button"]')).toBeVisible();

    // Verify required field indicators
    await expect(page.locator('label[for="api-url"] >> text=*')).toBeVisible();
    await expect(page.locator('label[for="api-token"] >> text=*')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-connection-settings/screenshot-initial.png',
      fullPage: true
    });

    // Assert no console errors
    expect(consoleErrors, 'no console errors during mount').toEqual([]);
  });

  test('form validation: buttons disabled when required fields empty', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Both buttons should be disabled when fields are empty
    await expect(page.locator('[data-testid="test-connection-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="save-button"]')).toBeDisabled();

    // Fill in API URL only
    await page.fill('[data-testid="api-url-input"]', 'http://localhost:8000');

    // Buttons should still be disabled (token is required)
    await expect(page.locator('[data-testid="test-connection-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="save-button"]')).toBeDisabled();

    // Fill in API Token
    await page.fill('[data-testid="api-token-input"]', 'test-token-123');

    // Buttons should now be enabled
    await expect(page.locator('[data-testid="test-connection-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="save-button"]')).toBeEnabled();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-connection-settings/screenshot-form-valid.png',
      fullPage: true
    });
  });

  test('test connection button shows loading state', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Fill in required fields
    await page.fill('[data-testid="api-url-input"]', 'http://localhost:8000');
    await page.fill('[data-testid="api-token-input"]', 'test-token-123');

    // Intercept test connection API call (mock it to avoid dependency)
    await page.route('**/api/settings/test-connection', async (route) => {
      // Delay to verify loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Connection successful!'
        })
      });
    });

    // Click test connection button
    const testButton = page.locator('[data-testid="test-connection-button"]');
    await testButton.click();

    // Verify loading state (button text changes to "Testing...")
    await expect(testButton).toHaveText('Testing...');
    await expect(testButton).toBeDisabled();

    // Wait for test to complete
    await page.waitForTimeout(600);

    // Verify button returns to normal state
    await expect(testButton).toHaveText('Test Connection');
    await expect(testButton).toBeEnabled();

    // Verify success message is displayed
    await expect(page.locator('[data-testid="test-result"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-result"] >> text=Connection successful!')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-connection-settings/screenshot-test-success.png',
      fullPage: true
    });
  });

  test('test connection shows error feedback on failure', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Fill in required fields
    await page.fill('[data-testid="api-url-input"]', 'http://invalid-url');
    await page.fill('[data-testid="api-token-input"]', 'invalid-token');

    // Intercept test connection API call with failure response
    await page.route('**/api/settings/test-connection', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Could not connect to Paperless-ngx'
        })
      });
    });

    // Click test connection button
    await page.click('[data-testid="test-connection-button"]');
    await page.waitForTimeout(200);

    // Verify error message is displayed
    await expect(page.locator('[data-testid="test-result"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-result"] >> text=Could not connect')).toBeVisible();

    // Verify error styling (red background)
    const testResult = page.locator('[data-testid="test-result"]');
    await expect(testResult).toHaveClass(/bg-red-50/);

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-connection-settings/screenshot-test-failure.png',
      fullPage: true
    });
  });

  test('save button shows loading state and dispatches events', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Fill in required fields
    await page.fill('[data-testid="api-url-input"]', 'http://localhost:8000');
    await page.fill('[data-testid="api-token-input"]', 'test-token-123');

    // Listen for settings events
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
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          requiresRestart: true
        })
      });
    });

    // Click save button
    const saveButton = page.locator('[data-testid="save-button"]');
    await saveButton.click();

    // Verify loading state
    await expect(saveButton).toHaveText('Saving...');
    await expect(saveButton).toBeDisabled();

    // Wait for save to complete
    await page.waitForTimeout(400);

    // Verify button returns to normal
    await expect(saveButton).toHaveText('Save Settings');

    // Verify save message is displayed
    await expect(page.locator('[data-testid="save-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-message"] >> text=Settings saved successfully')).toBeVisible();

    // Verify events were dispatched
    await page.waitForTimeout(100);
    expect(events).toContain('settings:changed');
    expect(events).toContain('settings:restart-required');
    expect(events).toContain('settings:saved');

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-connection-settings/screenshot-save-success.png',
      fullPage: true
    });
  });

  test('optional username field works correctly', async ({ page }) => {
    await page.goto(`${BASE}/settings#connection`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="connection-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Verify username field is present and has optional indicator
    await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
    await expect(page.locator('label[for="username"] >> text=(optional)')).toBeVisible();

    // Fill in username
    await page.fill('[data-testid="username-input"]', 'testuser');

    // Verify value is set
    await expect(page.locator('[data-testid="username-input"]')).toHaveValue('testuser');
  });
});
