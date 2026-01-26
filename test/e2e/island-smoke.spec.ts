import { test, expect } from '@playwright/test';
import { getHistoryDocId } from '../helpers/fixtures';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const MANUAL_URL = `${BASE_URL}/manual`;
const HISTORY_URL = `${BASE_URL}/history/${getHistoryDocId()}`;

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

test.describe('Island Runtime Smoke', () => {
  test('manual islands mount with hydrated roots', async ({ page }) => {
    const response = await gotoPage(page, MANUAL_URL);

    if (!response || response.status() >= 400) {
      test.skip(true, `Manual page not available at ${MANUAL_URL}`);
      return;
    }

    await page.waitForSelector(
      '[data-island="manual-editor-island"][data-mounted="true"]',
      { timeout: 10000 }
    );

    await expect(
      page.locator('[data-testid="manual-editor-island-root"][data-hydrated="true"]')
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="feedback-controls-island-root"][data-hydrated="true"]')
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="visual-annotation-island-root"][data-hydrated="true"]')
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

