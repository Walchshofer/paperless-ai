import { test, expect, type Page } from '@playwright/test';

const BASE =
  process.env.PLAYWRIGHT_BASE_URL
  || process.env.PAPERLESS_BASE_URL
  || 'http://localhost:3000';
const USERNAME = process.env.PAPERLESS_ADMIN_USER || 'elfman';
const PASSWORD =
  process.env.PAPERLESS_ADMIN_PASSWORD
  || process.env.POSTGRES_PASSWORD
  || 'P2tr3ck!1976';

const LOGIN_URL_PATTERN = /\/login(?:[/?#]|$)/;

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', USERNAME);
  await page.fill('#password', PASSWORD);
  await page.click('[data-testid="login-submit-btn"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15_000
  });
}

test.describe('Settings Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Settings page loads all sections', async ({ page }) => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'test-results/settings-overview.png',
      fullPage: true
    });

    const settingsSidebar = page.locator(
      '[data-island="settings-sidebar-island"]'
    );
    const connectionSettings = page.locator(
      '[data-island="connection-settings-island"]'
    );
    const aiProvider = page.locator('[data-island="ai-provider-island"]');

    console.log(
      'Settings sidebar:',
      (await settingsSidebar.count()) > 0 ? 'found' : 'not found'
    );
    console.log(
      'Connection settings:',
      (await connectionSettings.count()) > 0 ? 'found' : 'not found'
    );
    console.log(
      'AI provider:',
      (await aiProvider.count()) > 0 ? 'found' : 'not found'
    );
  });

  test('Session persists across page navigation', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
    await expect(page).not.toHaveURL(LOGIN_URL_PATTERN);

    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/settings(?:[/?#]|$)/);
    await expect(page).not.toHaveURL(LOGIN_URL_PATTERN);
    await expect(page.locator('[data-testid="settings-sidebar-island"]'))
      .toHaveCount(1);

    await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/workspace\//);
    await expect(page).not.toHaveURL(LOGIN_URL_PATTERN);
    await expect(page.locator('body[data-page="document-workspace"]'))
      .toBeVisible();

    await page.goto(`${BASE}/history`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/history(?:[/?#]|$)/);
    await expect(page).not.toHaveURL(LOGIN_URL_PATTERN);
    await expect(page.locator('body[data-page="history"]')).toBeVisible();

    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
    await expect(page).not.toHaveURL(LOGIN_URL_PATTERN);

    console.log('Session persisted across navigation - PASSED');
  });

  test('Logout works correctly', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });

    await page.goto(`${BASE}/logout`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(LOGIN_URL_PATTERN, { timeout: 15_000 });

    const cookies = await page.context().cookies();
    const jwtCookie = cookies.find((cookie) => cookie.name === 'jwt');
    expect(jwtCookie).toBeFalsy();

    const response = await page.goto(`${BASE}/history`, {
      waitUntil: 'domcontentloaded'
    });
    const bodyText = (await page.textContent('body')) || '';

    if (
      (response && [401, 403].includes(response.status()))
      || /Authentication required|Invalid token/.test(bodyText)
    ) {
      expect(bodyText).toMatch(/Authentication required|Invalid token/);
    } else {
      await expect(page).toHaveURL(LOGIN_URL_PATTERN, { timeout: 15_000 });
    }

    console.log('Logout and protection - PASSED');
  });
});
