import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');
const fixtures = require('../helpers/fixtures');

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('ContextSidebarIsland E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure predictable test environment
    await page.addInitScript(() => {
      window.__DISABLE_GITHUB_FETCH__ = true;
      try { localStorage.removeItem('paperless:context-sidebar.activeTab'); } catch (e) {}
      try { const w = window as unknown as Record<string, unknown>; delete w.__TEST_IS_ADMIN; } catch (e) {}
    });
  });

  test('island mounts and renders root', async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });

    await waitForIsland(page, 'context-sidebar-island', 10000);

    const root = page.locator('[data-testid="context-sidebar-root"]');
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute('data-hydrated', 'true');

    await page.screenshot({ path: 'test-results/playwright-context-sidebar/screenshot-mount.png', fullPage: true });
  });

  test('tabs switch content and persist selection', async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'context-sidebar-island', 10000);

    // Initially metadata tab should be visible
    await expect(page.locator('[data-testid="tab-metadata"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-panel-metadata"]')).toBeVisible();
    // SmartMetadata should mount in modern workspace; fall back to ManualEditor for older pages
    const smRoot = page.locator('[data-testid="smart-metadata-root"]');
    const manualRoot = page.locator('[data-testid="manual-editor-island-root"]');
    await expect((await smRoot.count()) ? smRoot : manualRoot).toBeVisible();

    // Switch to Content
    await page.click('[data-testid="tab-content"]');
    await expect(page.locator('[data-testid="tab-panel-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="document-content-island-root"]')).toBeVisible();

    // Switch to Chat
    await page.click('[data-testid="tab-chat"]');
    await expect(page.locator('[data-testid="tab-panel-chat"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-workspace-root"]')).toBeVisible();

    // Persist selection: click Content then reload
    await page.click('[data-testid="tab-content"]');
    await page.waitForTimeout(100);
    await page.reload({ waitUntil: 'networkidle' });
    await waitForIsland(page, 'context-sidebar-island', 10000);
    await expect(page.locator('[data-testid="tab-panel-content"]')).toBeVisible();

    await page.screenshot({ path: 'test-results/playwright-context-sidebar/screenshot-tabs.png', fullPage: true });
  });

  test('debug tab visibility respects admin flag', async ({ page }) => {
    const docId = fixtures.getTestDocId();

    // Non-admin: should NOT show debug
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'context-sidebar-island', 10000);
    await expect(page.locator('[data-testid="tab-debug"]')).toHaveCount(0);

    // Admin override via test hook: set global before navigation
    await page.addInitScript(() => { const w = window as unknown as Record<string, unknown>; (w as unknown as Record<string, unknown>).__TEST_IS_ADMIN = true; });
    await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'context-sidebar-island', 10000);

    await expect(page.locator('[data-testid="tab-debug"]')).toBeVisible();
    await page.click('[data-testid="tab-debug"]');
    await expect(page.locator('[data-testid="tab-panel-debug"]')).toBeVisible();
    await expect(page.locator('[data-testid="debug-content"]')).toBeVisible();

    await page.screenshot({ path: 'test-results/playwright-context-sidebar/screenshot-debug.png', fullPage: true });
  });
});
