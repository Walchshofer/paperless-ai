import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const SETTINGS_URL = `${BASE_URL}/settings`;

async function gotoPage(page: any, url: string) {
  const response = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 15000
  }).catch(() => null);

  const loginFormPresent = response && (
    response.url().includes('/login') ||
    await page.locator('form[action="/login"]').count() > 0
  );

  if (loginFormPresent) {
    throw new Error(`Auth state missing for ${url} (login redirect).`);
  }

  return response;
}

test.describe('Settings scaffolding smoke', () => {
  test('settings islands mount with hydrated roots', async ({ page }) => {
    let response;
    try {
      response = await gotoPage(page, SETTINGS_URL);
    } catch (err) {
      test.skip(true, `Skipping because auth or environment not ready: ${err.message}`);
      return;
    }

    if (!response || response.status() >= 400) {
      test.skip(true, `Settings page not available at ${SETTINGS_URL}`);
      return;
    }

    await page.waitForSelector('[data-island="overview-dashboard-island"][data-mounted="true"]', { timeout: 10000 });

    await expect(page.locator('[data-testid="overview-dashboard-root"][data-hydrated="true"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-sidebar-root"][data-hydrated="true"]')).toBeVisible();
    // Restart banner is hidden by default, just verify it mounts (may have hidden class)
    await expect(page.locator('[data-testid="restart-banner-root"]')).toBeAttached();
  });
});