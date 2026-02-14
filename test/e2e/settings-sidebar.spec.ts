import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');

const BASE =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.PAPERLESS_BASE_URL ||
  'http://localhost:3000';

async function openSettings(
  page: import('@playwright/test').Page,
  hash = 'overview'
) {
  await page.goto(`${BASE}/settings#${hash}`, { waitUntil: 'domcontentloaded' });
  await waitForIsland(page, 'settings-sidebar-island', 10000);
  await expect(
    page.locator('[data-testid="settings-sidebar-root"]')
  ).toBeVisible();
}

async function expectCategoryActive(
  page: import('@playwright/test').Page,
  categoryId: string
) {
  await expect(
    page.locator(`[data-testid="category-${categoryId}"]`)
  ).toHaveClass(/bg-cyan-500\/10/);
}

test.describe('SettingsSidebarIsland smoke test', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __DISABLE_GITHUB_FETCH__?: boolean })
        .__DISABLE_GITHUB_FETCH__ = true;
    });

    await page.goto(`${BASE}/settings#overview`, {
      waitUntil: 'domcontentloaded'
    });
    await page.evaluate(() => {
      localStorage.setItem('settings:developerMode', 'false');
      localStorage.setItem('settings:lastCategory', 'overview');
    });
  });

  test('sidebar mounts and displays all default categories', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (
        text.includes('api.github.com') ||
        text.includes('Failed to fetch stars') ||
        text.includes('Failed to load resource')
      ) {
        return;
      }
      consoleErrors.push(text);
    });

    await openSettings(page, 'overview');

    await expect(
      page.locator('[data-testid="settings-sidebar-root"]')
    ).toContainText('Control Center');

    await expect(page.locator('[data-testid="category-overview"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-connection"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-ai-provider"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-advanced"]')).toBeVisible();

    await expect(
      page.locator('[data-testid="category-developer"]')
    ).not.toBeVisible();
    await expect(page.locator('[data-testid="category-prompts"]')).not.toBeVisible();

    await expect(page.locator('[data-testid="developer-toggle"]')).toBeVisible();

    expect(consoleErrors, 'no console errors during run').toEqual([]);
  });

  test(
    'developer mode toggle shows/hides developer categories and persists ' +
      'to localStorage',
    async ({ page }) => {
      await openSettings(page, 'overview');

      await expect(
        page.locator('[data-testid="category-developer"]')
      ).not.toBeVisible();
      await expect(
        page.locator('[data-testid="category-prompts"]')
      ).not.toBeVisible();

      await page.click('[data-testid="developer-toggle"]');
      await page.waitForTimeout(200);

      await expect(page.locator('[data-testid="category-developer"]')).toBeVisible();
      await expect(page.locator('[data-testid="category-prompts"]')).toBeVisible();

      const developerMode = await page.evaluate(() => {
        return localStorage.getItem('settings:developerMode');
      });
      expect(developerMode).toBe('true');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForIsland(page, 'settings-sidebar-island', 10000);

      await expect(page.locator('[data-testid="category-developer"]')).toBeVisible();
      await expect(page.locator('[data-testid="category-prompts"]')).toBeVisible();

      await page.click('[data-testid="developer-toggle"]');
      await page.waitForTimeout(200);

      await expect(
        page.locator('[data-testid="category-developer"]')
      ).not.toBeVisible();
      await expect(
        page.locator('[data-testid="category-prompts"]')
      ).not.toBeVisible();

      const developerModeAfter = await page.evaluate(() => {
        return localStorage.getItem('settings:developerMode');
      });
      expect(developerModeAfter).toBe('false');
    }
  );

  test('category navigation updates active state and URL hash', async ({ page }) => {
    await openSettings(page, 'overview');

    await expectCategoryActive(page, 'overview');

    await page.click('[data-testid="category-connection"]');
    await page.waitForTimeout(200);

    await expectCategoryActive(page, 'connection');
    expect(page.url()).toContain('#connection');

    const lastCategory = await page.evaluate(() => {
      return localStorage.getItem('settings:lastCategory');
    });
    expect(lastCategory).toBe('connection');

    await page.click('[data-testid="category-ai-provider"]');
    await page.waitForTimeout(200);

    await expectCategoryActive(page, 'ai-provider');
    expect(page.url()).toContain('#ai-provider');
  });

  test('hash navigation updates active category', async ({ page }) => {
    await openSettings(page, 'advanced');
    await expectCategoryActive(page, 'advanced');

    await page.evaluate(() => {
      window.location.hash = 'connection';
    });
    await page.waitForTimeout(200);

    await expectCategoryActive(page, 'connection');
  });
});
