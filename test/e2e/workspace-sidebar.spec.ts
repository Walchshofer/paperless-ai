import { test, expect } from '@playwright/test';

const {
  navigateToWorkspace,
  waitForIslandMount,
  switchTab
} = require('../helpers/workspace-fixtures');

const { getTestDocId } = require('../helpers/fixtures');

test.describe('Workspace sidebar tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_IS_ADMIN = true;
    });
  });

  test('metadata tab shows metadata panel', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island');

    await expect(page.locator('[data-testid="tab-panel-metadata"]')).toBeVisible();
    await expect(page.locator('[data-testid="panel-header-metadata"]')).toBeVisible();
  });

  test('content tab shows OCR text panel', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await switchTab(page, 'content');

    await expect(page.locator('[data-testid="tab-panel-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="document-content-island-root"]')).toBeVisible();
  });

  test('chat tab loads workspace chat UI', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await switchTab(page, 'chat');

    await expect(page.locator('[data-testid="tab-panel-chat"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-workspace-root"]')).toBeVisible();
  });

  test('visual tab shows visual panel', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await switchTab(page, 'visual');

    await expect(page.locator('[data-testid="tab-panel-visual"]')).toBeVisible();
    await expect(page.locator('[data-testid="visual-tab-panel"]')).toBeVisible();
  });

  test('debug tab shows debug content when admin', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await switchTab(page, 'debug');

    await expect(page.locator('[data-testid="tab-panel-debug"]')).toBeVisible();
    await expect(page.locator('[data-testid="debug-content"]')).toBeVisible();
  });

  test('tab switching preserves unsaved state', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);

    await page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent('workspace:dirty', { detail: { documentId: id } }));
    }, docId);

    await expect(page.locator('[data-testid="document-context-bar-root"]'))
      .toHaveAttribute('data-status', 'unsaved');

    await switchTab(page, 'content');
    await expect(page.locator('[data-testid="document-context-bar-root"]'))
      .toHaveAttribute('data-status', 'unsaved');

    await expect(page.locator('[data-testid="tab-content"]'))
      .toHaveAttribute('aria-selected', 'true');
  });
});
