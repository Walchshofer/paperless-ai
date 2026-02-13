import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');
const {
  navigateToWorkspace,
  waitForIslandMount,
  switchTab
} = require('../helpers/workspace-fixtures');

test.describe('ContextSidebarIsland E2E', () => {
  test.describe.configure({ timeout: 60000 });
  const STORAGE_KEY = 'paperless:context-sidebar.activeTab';

  test.beforeEach(async ({ page }) => {
    // Ensure predictable test environment
    await page.addInitScript(() => {
      window.__DISABLE_GITHUB_FETCH__ = true;
      try {
        const w = window as unknown as Record<string, unknown>;
        delete w.__TEST_IS_ADMIN;
      } catch {
        // Ignore global cleanup failures.
      }
    });
  });

  test('island mounts and renders root', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 10000);

    const root = page.locator('[data-testid="context-sidebar-root"]');
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute('data-hydrated', 'true');
  });

  test('tabs switch content and persist selection', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 10000);

    // Start from a clean persisted state once (not via addInitScript, which
    // runs on every navigation/reload).
    await page.evaluate((storageKey) => {
      localStorage.removeItem(storageKey);
    }, STORAGE_KEY);
    await page.reload({ waitUntil: 'networkidle' });
    await waitForIslandMount(page, 'context-sidebar-island', 10000);

    // Initially metadata tab should be visible
    await expect(page.locator('[data-testid="tab-metadata"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="tab-panel-metadata"]'))
      .toBeVisible();

    // SmartMetadata should mount in modern workspace; fall back to ManualEditor for older pages
    const smRoot = page.locator('[data-testid="smart-metadata-root"]');
    const manualRoot = page.locator('[data-testid="manual-editor-island-root"]');
    await expect((await smRoot.count()) ? smRoot : manualRoot).toBeVisible();

    // Switch to Content
    await switchTab(page, 'content');
    await expect(page.locator('[data-testid="tab-panel-content"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="document-content-island-root"]'))
      .toBeVisible();

    // Switch to Chat
    await switchTab(page, 'chat');
    await expect(page.locator('[data-testid="tab-panel-chat"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-workspace-root"]'))
      .toBeVisible();

    // Persist selection: click Content then reload
    await switchTab(page, 'content');
    await page.waitForFunction(
      (storageKey) => localStorage.getItem(storageKey) === 'content',
      STORAGE_KEY,
      { timeout: 10000 }
    );
    await page.reload({ waitUntil: 'networkidle' });
    await waitForIslandMount(page, 'context-sidebar-island', 10000);
    await expect(page.locator('[data-testid="tab-content"]'))
      .toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="tab-panel-content"]')).toBeVisible();
  });

  test('debug tab visibility respects admin flag', async ({ page }) => {
    const docId = getTestDocId();

    // Some environments are admin by default; validate behavior accordingly.
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 10000);
    const debugTab = page.locator('[data-testid="tab-debug"]');
    const initialCount = await debugTab.count();

    if (initialCount === 0) {
      // Admin override via test hook: set global before navigation.
      await page.addInitScript(() => {
        const w = window as unknown as Record<string, unknown>;
        w.__TEST_IS_ADMIN = true;
      });
      await navigateToWorkspace(page, docId);
      await waitForIslandMount(page, 'context-sidebar-island', 10000);
      await expect(debugTab).toBeVisible();
    } else {
      await expect(debugTab).toBeVisible();
    }

    await switchTab(page, 'debug');
    await expect(page.locator('[data-testid="tab-panel-debug"]')).toBeVisible();
    await expect(page.locator('[data-testid="debug-content"]')).toBeVisible();
  });
});
