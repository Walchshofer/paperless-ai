import { test, expect } from '@playwright/test';

const { waitForIsland } = require('../helpers/island-waits');

const BASE =
  process.env.PLAYWRIGHT_BASE_URL
  || process.env.PAPERLESS_BASE_URL
  || 'http://localhost:3000';

async function openConnectionSettings(
  page: import('@playwright/test').Page
) {
  await page.goto(`${BASE}/settings#connection`, { waitUntil: 'domcontentloaded' });
  await waitForIsland(page, 'connection-settings-island', 10000);
  await expect(page.locator('[data-testid="settings-section-connection"]'))
    .toBeVisible();
  await expect(page.locator('[data-testid="connection-settings-root"]'))
    .toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__DISABLE_GITHUB_FETCH__ = true;
  });
});

test.describe('ConnectionSettingsIsland smoke test', () => {
  test.describe.configure({ timeout: 60000 });

  test('island mounts and displays all connection fields', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await openConnectionSettings(page);

    const root = page.locator('[data-testid="connection-settings-root"]');
    await expect(
      root.getByRole('heading', { name: 'Connection Center' })
    ).toBeVisible();
    await expect(page.locator('[data-testid="paperless-url-input"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="paperless-token-input"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="paperless-username-input"]'))
      .toBeVisible();

    const paperlessSection = page.locator('[data-testid="section-paperless"]');
    await expect(
      paperlessSection.getByRole('button', { name: /Test Connection/i })
    ).toBeVisible();
    await expect(page.locator('[data-testid="connection-save-button"]'))
      .toBeVisible();

    const filteredConsoleErrors = consoleErrors.filter((msg) => {
      return !/Failed to fetch stars|api\.github\.com|status of 403/.test(msg);
    });
    expect(
      filteredConsoleErrors,
      'no console errors during mount (excluding known GitHub noise)'
    ).toEqual([]);
  });

  test('form validation: buttons disabled when required fields empty',
    async ({ page }) => {
      await openConnectionSettings(page);

      const testButton = page
        .locator('[data-testid="section-paperless"]')
        .getByRole('button', { name: /Test Connection/i });
      const saveButton = page.locator('[data-testid="connection-save-button"]');

      await expect(saveButton).toBeDisabled();

      await page.fill('[data-testid="paperless-url-input"]', '');
      await page.fill('[data-testid="paperless-token-input"]', '');

      await expect(testButton).toBeDisabled();
      await expect(saveButton).toBeEnabled();

      await page.fill('[data-testid="paperless-url-input"]',
        'http://localhost:8000');
      await page.fill('[data-testid="paperless-token-input"]', 'test-token-123');

      await expect(testButton).toBeEnabled();
      await expect(saveButton).toBeEnabled();
    });

  test('test connection button shows loading state', async ({ page }) => {
    await openConnectionSettings(page);

    await page.route('**/api/settings/test-connection', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Connection successful!'
        })
      });
    });

    await page.fill('[data-testid="paperless-url-input"]',
      'http://localhost:8000');
    await page.fill('[data-testid="paperless-token-input"]', 'test-token-123');

    const paperlessSection = page.locator('[data-testid="section-paperless"]');
    const testButton = paperlessSection
      .getByRole('button', { name: /Test Connection/i });

    await testButton.click();
    await expect(testButton).toBeDisabled();
    await expect(paperlessSection.getByText('Connection successful!'))
      .toBeVisible();
    await expect(testButton).toBeEnabled();
  });

  test('test connection shows error feedback on failure', async ({ page }) => {
    await openConnectionSettings(page);

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

    await page.fill('[data-testid="paperless-url-input"]', 'http://invalid-url');
    await page.fill('[data-testid="paperless-token-input"]', 'invalid-token');

    const paperlessSection = page.locator('[data-testid="section-paperless"]');
    await paperlessSection
      .getByRole('button', { name: /Test Connection/i })
      .click();

    const errorResult = paperlessSection.locator('div.bg-red-50')
      .filter({ hasText: 'Could not connect to Paperless-ngx' })
      .first();
    await expect(errorResult).toBeVisible();
  });

  test('save button shows loading state and dispatches events',
    async ({ page }) => {
      await openConnectionSettings(page);

      const events: string[] = [];
      await page.exposeFunction('logEvent', (eventName: string) => {
        events.push(eventName);
      });

      await page.evaluate(() => {
        document.addEventListener('settings:restart-required', () => {
          (window as unknown as { logEvent?: (_s: string) => void })
            .logEvent?.('settings:restart-required');
        });
        document.addEventListener('settings:saved', () => {
          (window as unknown as { logEvent?: (_s: string) => void })
            .logEvent?.('settings:saved');
        });
      });

      await page.route('**/api/settings/save', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            restartRequired: true
          })
        });
      });

      await page.fill('[data-testid="paperless-url-input"]',
        'http://localhost:8000');
      await page.fill('[data-testid="paperless-token-input"]', 'test-token-123');

      const saveButton = page.locator('[data-testid="connection-save-button"]');
      await expect(saveButton).toBeEnabled();

      await saveButton.click();
      await expect(saveButton).toBeDisabled();

      const saveMessage = page.locator('[data-testid="save-message"]');
      await expect(saveMessage).toBeVisible();
      await expect(saveMessage)
        .toContainText('All connection settings saved successfully');

      expect(events).toContain('settings:restart-required');
      expect(events).toContain('settings:saved');
    });

  test('optional username field works correctly', async ({ page }) => {
    await openConnectionSettings(page);

    await expect(page.getByText('Username (Optional)')).toBeVisible();
    const usernameInput = page.locator('[data-testid="paperless-username-input"]');
    await expect(usernameInput).toBeVisible();

    await usernameInput.fill('testuser');
    await expect(usernameInput).toHaveValue('testuser');
  });
});
