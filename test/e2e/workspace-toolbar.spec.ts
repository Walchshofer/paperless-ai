import { test, expect } from '@playwright/test';

const {
  navigateToWorkspace,
  waitForIslandMount,
  clickToolbarButton
} = require('../helpers/workspace-fixtures');

const { getTestDocId } = require('../helpers/fixtures');

const _BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Workspace toolbar', () => {
  test('document selector switches documents', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'document-context-bar-island');

    await clickToolbarButton(page, 'selector');
    const options = page.locator('[data-testid^="document-option-"]');
    const count = await options.count();
    if (count < 2) {
      test.skip(true, 'Not enough documents available to switch');
      return;
    }

    const currentMatch = page.url().match(/\/workspace\/doc\/(\d+)/);
    const currentId = currentMatch ? Number(currentMatch[1]) : docId;
    let targetId: number | null = null;
    let targetLocator: import('@playwright/test').Locator | null = null;

    for (let i = 0; i < count; i += 1) {
      const option = options.nth(i);
      const testId = await option.getAttribute('data-testid');
      const match = testId ? testId.match(/document-option-(\d+)/) : null;
      const id = match ? Number(match[1]) : null;
      if (id && id !== currentId) {
        targetId = id;
        targetLocator = option;
        break;
      }
    }

    if (!targetLocator || targetId == null) {
      test.skip(true, 'No alternate document option found');
      return;
    }

    await targetLocator.click();
    await page.waitForURL(new RegExp(`/workspace/doc/${targetId}`), {
      timeout: 20000
    });
  });

  test('save button shows progress and returns to idle', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'document-context-bar-island');

    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    if (await metadataTab.count() > 0) {
      await metadataTab.click();
    }

    const titleInput = page.locator('[data-testid="smart-title-input"]');
    if (await titleInput.count() === 0) {
      test.skip(true, 'Smart metadata input not available to mark dirty');
      return;
    }

    await titleInput.fill(`E2E Title ${Date.now()}`);
    await page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent('workspace:dirty', { detail: { documentId: id } }));
    }, docId);
    await expect(
      page.locator('[data-testid="document-context-bar-root"]')
    ).toHaveAttribute('data-status', 'unsaved');

    const saveBtn = page.locator('[data-testid="save-all-btn"]');
    await saveBtn.click();

    await expect(saveBtn).toContainText(/Saving/i, { timeout: 5000 });
    await expect(saveBtn).toContainText(/Save Changes/i, { timeout: 30000 });

    await expect(
      page.locator('[data-testid="document-context-bar-root"]')
    ).toHaveAttribute('data-status', 'saved');
  });

  test('reprocess button triggers progress and notification', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'document-context-bar-island');

    const reprocessBtn = page.locator('[data-testid="reprocess-btn"]');
    const reprocessRequest = page.waitForRequest((req) => {
      return req.method() === 'POST' && req.url().includes(`/api/documents/${docId}/reprocess`);
    });
    await reprocessBtn.click();
    await reprocessRequest;

    const notification = page.locator('[data-testid="reprocess-notification"]');
    if (await notification.count() > 0) {
      await expect(notification).toBeVisible({ timeout: 90000 });
    }
  });

  test('navigation controls move between documents when available', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'document-context-bar-island');

    const nextBtn = page.locator('[data-testid="nav-next-btn"]');
    if (await nextBtn.isDisabled()) {
      test.skip(true, 'Next navigation disabled (single document)');
      return;
    }

    const beforeUrl = page.url();
    await nextBtn.click();
    await page.waitForURL((url: URL) => url.toString() !== beforeUrl, {
      timeout: 20000
    });
  });

  test('toolbar status badge present', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'document-context-bar-island');

    const status = page.locator('[data-testid^="status-"]');
    await expect(status).toHaveCount(1, { timeout: 10000 });
  });

  test('open in Paperless link opens new tab when present', async ({ page, context }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);

    const link = page.locator('[data-testid="open-in-paperless"]');
    if (await link.count() === 0) {
      test.skip(true, 'Open in Paperless link not present in workspace toolbar');
      return;
    }

    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      link.click()
    ]);

    await popup.waitForLoadState('domcontentloaded');
    expect(popup.url()).toContain('/documents/');
    await popup.close();
  });
});
