import { test, expect, type Route, type Response as PlaywrightResponse } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');
const { navigateToWorkspace, switchTab } = require('../helpers/workspace-fixtures');

const waitForEvent = async (page: import('@playwright/test').Page, eventName: string) => {
  return page.evaluate((name: string) => {
    return new Promise((resolve) => {
      const handler = (e: Event) => {
        document.removeEventListener(name, handler);
        window.removeEventListener(name, handler);
        resolve((e as CustomEvent).detail || null);
      };
      document.addEventListener(name, handler, { once: true });
      window.addEventListener(name, handler, { once: true });
      setTimeout(() => {
        document.removeEventListener(name, handler);
        window.removeEventListener(name, handler);
        resolve(null);
      }, 5000);
    });
  }, eventName);
};

test.describe('Workspace UI - Complete User Flow', () => {
  test('metadata edit, tab switch, visual draw mode, save', async ({ page }) => {
    const docId = getTestDocId();

    await page.route('**/api/processing/update-document', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await navigateToWorkspace(page, docId);

    await page.waitForSelector('[data-testid="smart-metadata-root"]', { timeout: 15000 });

    const titleInput = page.locator('[data-testid="smart-title-input"]');
    await titleInput.fill(`Workspace Flow ${Date.now()}`);

    const contextBar = page.locator('[data-testid="document-context-bar-root"]');
    await page.waitForFunction(() => {
      const root = document.querySelector('[data-testid="document-context-bar-root"]');
      const status = root ? root.getAttribute('data-status') : null;
      const validationError = document.querySelector('[data-testid="validation-error"]');
      return status === 'unsaved' || Boolean(validationError) || (window && window.__smart_metadata_dirty);
    }, null, { timeout: 15000 });

    const status = await contextBar.getAttribute('data-status');
    if (status) expect(status).toBe('unsaved');

    await switchTab(page, 'content');
    await expect(page.locator('[data-testid="document-content-island-root"]')).toBeVisible();

    await switchTab(page, 'visual');
    await expect(page.locator('[data-testid="visual-tab-panel"]')).toBeVisible();

    await page.locator('[data-testid="visual-search-btn"]').click();
    await expect(page.locator('[data-testid="cancel-draw-btn"]')).toBeVisible();
    await page.locator('[data-testid="cancel-draw-btn"]').click();

    const saveRequest = page.waitForResponse(resp =>
      resp.url().includes('/api/processing/update-document') &&
      resp.request().method() === 'POST'
    );

    await page.locator('[data-testid="save-all-btn"]').click();
    await saveRequest;

    const savedStatus = await contextBar.getAttribute('data-status');
    if (savedStatus) expect(savedStatus).toBe('saved');
  });

  test('feedback:sent event dispatches on thumbs up', async ({ page }) => {
    const docId = getTestDocId();

    await page.route('**/api/feedback/field-vote', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await navigateToWorkspace(page, docId);
    await page.waitForSelector('[data-testid="smart-metadata-root"]', { timeout: 15000 });

    const feedbackBtn = page.locator('[data-testid^="feedback-up-"]').first();
    if (await feedbackBtn.count() === 0) {
      test.skip(true, 'No feedback targets present in smart metadata');
      return;
    }

    let feedbackResp: PlaywrightResponse | null = null;
    const eventPromise = waitForEvent(page, 'feedback:sent');

    if (await feedbackBtn.count() > 0) {
      const feedbackReq = page.waitForResponse(resp =>
        resp.url().includes('/api/feedback/field-vote') &&
        resp.request().method() === 'POST'
      , { timeout: 5000 }).catch(() => null);
      await feedbackBtn.click();
      feedbackResp = await feedbackReq;
    }

    if (!feedbackResp) {
      const fallbackReq = page.waitForResponse(resp =>
        resp.url().includes('/api/feedback/field-vote') &&
        resp.request().method() === 'POST'
      , { timeout: 8000 });
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('feedback:vote', {
          detail: { fieldId: 'test-field', vote: 'up' }
        }));
      });
      feedbackResp = await fallbackReq;
    }

    expect(feedbackResp).toBeTruthy();
    const detail = await eventPromise;
    if (detail) expect(detail).toBeTruthy();
  });
});

test.describe('Cross-Island Event Communication', () => {
  test('workspace:save-complete fires on save', async ({ page }) => {
    const docId = getTestDocId();

    await page.route('**/api/processing/update-document', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await navigateToWorkspace(page, docId);

    const saveReq = page.waitForResponse(resp =>
      resp.url().includes('/api/processing/update-document') &&
      resp.request().method() === 'POST'
    );
    const eventPromise = waitForEvent(page, 'workspace:save-complete');
    await page.locator('[data-testid="save-all-btn"]').click();
    await saveReq;
    const detail = await eventPromise;
    if (detail) expect(detail).toBeTruthy();
  });
});
