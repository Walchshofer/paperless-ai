import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');

const BASE =
  process.env.PLAYWRIGHT_BASE_URL
  || process.env.PAPERLESS_BASE_URL
  || 'http://localhost:3000';

async function openSettings(page: import('@playwright/test').Page, hash = 'overview') {
  await page.goto(`${BASE}/settings#${hash}`, { waitUntil: 'networkidle' });
  await waitForIsland(page, 'settings-sidebar-island', 10000);
  await waitForIsland(page, 'restart-banner-island', 10000);
}

async function openConnection(page: import('@playwright/test').Page) {
  await openSettings(page, 'connection');
  await waitForIsland(page, 'connection-settings-island', 10000);
  await expect(page.locator('[data-testid="settings-section-connection"]')).toBeVisible();
}

async function triggerConnectionSaveWithRestart(page: import('@playwright/test').Page) {
  await page.route('**/api/settings/save', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, restartRequired: true })
    });
  });

  await page.fill('[data-testid="paperless-url-input"]', 'http://localhost:8000');
  await page.fill('[data-testid="paperless-token-input"]', 'test-token');
  await page.click('[data-testid="connection-save-button"]');
  await page.waitForTimeout(250);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__DISABLE_GITHUB_FETCH__ = true;
  });
});

test.describe('Settings Integration (Current IA)', () => {
  test('restart banner appears when connection settings require restart', async ({ page }) => {
    await openConnection(page);

    await expect(page.locator('[data-testid="restart-banner-root"]')).not.toBeVisible();

    await triggerConnectionSaveWithRestart(page);

    await expect(page.locator('[data-testid="restart-banner-root"]')).toBeVisible();
    await expect(page.locator('[data-testid="restart-message"]')).toContainText('Restart Required');
    await expect(page.locator('[data-testid="changed-settings"]')).toContainText('Connections');
  });

  test('restart banner persists across category navigation', async ({ page }) => {
    await openConnection(page);
    await triggerConnectionSaveWithRestart(page);
    await expect(page.locator('[data-testid="restart-banner-root"]')).toBeVisible();

    const sidebar = page.locator('[data-testid="settings-sidebar-root"]');
    await sidebar.getByRole('link', { name: /AI Provider/i }).click();
    await waitForIsland(page, 'ai-provider-island', 10000);
    await expect(page.locator('[data-testid="settings-section-ai-provider"]')).toBeVisible();
    await expect(page.locator('[data-testid="restart-banner-root"]')).toBeVisible();
  });

  test('restart banner can be dismissed', async ({ page }) => {
    await openConnection(page);
    await triggerConnectionSaveWithRestart(page);
    await expect(page.locator('[data-testid="restart-banner-root"]')).toBeVisible();

    await page.locator('[data-testid="dismiss-button"]').evaluate((el: HTMLElement) => el.click());
    await expect(page.locator('[data-testid="restart-banner-root"]')).not.toBeVisible();
  });

  test('sidebar navigation works without section state loss', async ({ page }) => {
    await openSettings(page, 'overview');
    const sidebar = page.locator('[data-testid="settings-sidebar-root"]');

    await sidebar.getByRole('link', { name: /Connection/i }).click();
    await waitForIsland(page, 'connection-settings-island', 10000);
    await expect(page.locator('[data-testid="settings-section-connection"]')).toBeVisible();

    await sidebar.getByRole('link', { name: /AI Provider/i }).click();
    await waitForIsland(page, 'ai-provider-island', 10000);
    await expect(page.locator('[data-testid="settings-section-ai-provider"]')).toBeVisible();

    await sidebar.getByRole('link', { name: /Overview/i }).click();
    await waitForIsland(page, 'overview-dashboard-island', 10000);
    await expect(page.locator('[data-testid="settings-section-overview"]')).toBeVisible();
  });

  test('paperless connection test action works', async ({ page }) => {
    await openConnection(page);

    await page.route('**/api/settings/test-connection', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Connection successful!'
        })
      });
    });

    await page.fill('[data-testid="paperless-url-input"]', 'http://localhost:8000');
    await page.fill('[data-testid="paperless-token-input"]', 'test-token');

    const sectionPaperless = page.locator('[data-testid="section-paperless"]');
    const testButton = sectionPaperless.getByRole('button', { name: /Test Connection/i });
    await testButton.click();

    await expect(sectionPaperless.locator('text=Connection successful')).toBeVisible();
  });

  test('core settings islands mount correctly', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (text.includes('api.github.com') || text.includes('Failed to fetch stars')) return;
      consoleErrors.push(text);
    });

    await openSettings(page, 'overview');

    await waitForIsland(page, 'overview-dashboard-island', 10000);
    await expect(page.locator('[data-testid="overview-dashboard-island"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-sidebar-root"]')).toBeVisible();

    const sidebar = page.locator('[data-testid="settings-sidebar-root"]');
    await sidebar.getByRole('link', { name: /Connection/i }).click();
    await waitForIsland(page, 'connection-settings-island', 10000);
    await expect(page.locator('[data-testid="connection-settings-root"]')).toBeVisible();

    await sidebar.getByRole('link', { name: /AI Provider/i }).click();
    await waitForIsland(page, 'ai-provider-island', 10000);
    await expect(page.locator('[data-testid="ai-provider-root"]')).toBeVisible();

    expect(consoleErrors, 'no console errors during settings island mounting').toEqual([]);
  });

  test('connection save dispatches restart-related events', async ({ page }) => {
    await openConnection(page);

    const events: string[] = [];
    await page.exposeFunction('logEvent', (name: string) => {
      events.push(name);
    });

    await page.evaluate(() => {
      document.addEventListener('settings:saved', () => {
        (
          window as unknown as {
            logEvent?: (_name: string) => void;
          }
        ).logEvent?.('settings:saved');
      });
      document.addEventListener('settings:restart-required', () => {
        (
          window as unknown as {
            logEvent?: (_name: string) => void;
          }
        ).logEvent?.('settings:restart-required');
      });
    });

    await triggerConnectionSaveWithRestart(page);

    expect(events).toContain('settings:saved');
    expect(events).toContain('settings:restart-required');
    await expect(page.locator('[data-testid="restart-banner-root"]')).toBeVisible();
  });

  test('ai provider save dispatches changed + saved events', async ({ page }) => {
    await openSettings(page, 'ai-provider');
    await waitForIsland(page, 'ai-provider-island', 10000);

    const events: string[] = [];
    await page.exposeFunction('logAiEvent', (name: string) => {
      events.push(name);
    });

    await page.evaluate(() => {
      document.addEventListener('settings:changed', () => {
        (
          window as unknown as {
            logAiEvent?: (_name: string) => void;
          }
        ).logAiEvent?.('settings:changed');
      });
      document.addEventListener('settings:saved', () => {
        (
          window as unknown as {
            logAiEvent?: (_name: string) => void;
          }
        ).logAiEvent?.('settings:saved');
      });
    });

    await page.route('**/api/settings/save', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.selectOption('[data-testid="provider-select"]', 'ollama');
    await page.click('[data-testid="ai-provider-save-button"]');
    await expect(page.locator('[data-testid="save-message"]')).toBeVisible();

    expect(events).toContain('settings:changed');
    expect(events).toContain('settings:saved');
  });
});
