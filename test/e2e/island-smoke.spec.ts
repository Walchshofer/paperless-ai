import { test, expect, Page } from '@playwright/test';
import { getHistoryDocId } from '../helpers/fixtures';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const WORKSPACE_URL = `${BASE_URL}/workspace/doc/latest?tab=metadata`;
const HISTORY_URL = `${BASE_URL}/history/${getHistoryDocId()}`;

async function gotoPage(page: Page, url: string) {
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

test.describe('Island Runtime Smoke', () => {
  test('workspace islands mount with hydrated roots', async ({ page }) => {
    const response = await gotoPage(page, WORKSPACE_URL);

    if (!response || response.status() >= 400) {
      test.skip(true, `Workspace page not available at ${WORKSPACE_URL}`);
      return;
    }

    await page.waitForSelector(
      '[data-island="document-context-bar-island"][data-mounted="true"]',
      { timeout: 10000 }
    );
    await page.waitForSelector(
      '[data-island="overlay-viewer-island"][data-mounted="true"]',
      { timeout: 10000 }
    );
    await page.waitForSelector(
      '[data-island="context-sidebar-island"][data-mounted="true"]',
      { timeout: 10000 }
    );

    await expect(
      page.locator('[data-testid="document-context-bar-root"][data-hydrated="true"]')
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="overlay-viewer-root"][data-hydrated="true"]')
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="context-sidebar-root"][data-hydrated="true"]')
    ).toBeVisible();
  });

  test('history islands mount with hydrated roots', async ({ page }) => {
    const response = await gotoPage(page, HISTORY_URL);

    if (!response || response.status() >= 400) {
      test.skip(true, `History page not available at ${HISTORY_URL}`);
      return;
    }

    await page.waitForSelector(
      '[data-island="history-tabs-island"][data-mounted="true"]',
      { timeout: 10000 }
    );

    await expect(
      page.locator('[data-testid="history-tabs-root"][data-hydrated="true"]')
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="overlay-viewer-root"][data-hydrated="true"]')
    ).toBeVisible();
  });
});

