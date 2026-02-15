import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');
const { switchTab } = require('../helpers/workspace-fixtures');
const fixtures = require('../helpers/fixtures');

const BASE =
  process.env.PLAYWRIGHT_BASE_URL
  || process.env.PAPERLESS_BASE_URL
  || 'http://localhost:3000';

async function openWorkspace(page: import('@playwright/test').Page) {
  const docId = fixtures.getTestDocId();
  await page.goto(`${BASE}/workspace/doc/${docId}`, { waitUntil: 'domcontentloaded' });
  await waitForIsland(page, 'context-sidebar-island', 10000);
  await expect(page.locator('[data-testid="context-sidebar-root"]')).toBeVisible();
}

test.describe('Sidebar Tab Restructuring', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__DISABLE_GITHUB_FETCH__ = true;
      try {
        localStorage.removeItem('paperless:context-sidebar.activeTab');
      } catch (_err) {
        // ignore localStorage errors
      }
    });
  });

  test('shows renamed tabs with correct icons', async ({ page }) => {
    await openWorkspace(page);

    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    await expect(metadataTab).toContainText(/Smart/i);
    await expect(metadataTab.locator('.fa-wand-magic-sparkles')).toBeVisible();

    const contentTab = page.locator('[data-testid="tab-content"]');
    await expect(contentTab).toContainText(/OCR/i);
    await expect(contentTab.locator('.fa-file-lines')).toBeVisible();

    const chatTab = page.locator('[data-testid="tab-chat"]');
    await expect(chatTab).toContainText(/Chat/i);
    await expect(chatTab.locator('.fa-comments')).toBeVisible();

    const visualTab = page.locator('[data-testid="tab-visual"]');
    await expect(visualTab).toContainText(/Visual/i);
    await expect(visualTab.locator('.fa-draw-polygon')).toBeVisible();
  });

  test('shows tab tooltips', async ({ page }) => {
    await openWorkspace(page);

    await expect(page.locator('[data-testid="tab-metadata"]')).toHaveAttribute(
      'title',
      'AI-assisted metadata editing with smart suggestions'
    );
    await expect(page.locator('[data-testid="tab-content"]')).toHaveAttribute(
      'title',
      'View Tesseract OCR extracted text (read-only)'
    );
    await expect(page.locator('[data-testid="tab-chat"]')).toHaveAttribute(
      'title',
      'Chat with AI about documents using RAG or document-specific context'
    );
    await expect(page.locator('[data-testid="tab-visual"]')).toHaveAttribute(
      'title',
      'Label fields and perform visual search'
    );
  });

  test('uses increased sidebar width baseline', async ({ page }) => {
    await openWorkspace(page);

    const sidebar = page.locator('.workspace-sidebar');
    const boundingBox = await sidebar.boundingBox();
    expect(boundingBox?.width).toBeGreaterThanOrEqual(480);
  });

  test('shows panel headers with updated context copy', async ({ page }) => {
    await openWorkspace(page);

    const metadataHeader = page.locator('[data-testid="panel-header-metadata"]');
    await expect(metadataHeader).toBeVisible();
    await expect(metadataHeader).toContainText('Intelligent Extraction');
    await expect(metadataHeader).toContainText('metadata synchronization');

    await switchTab(page, 'content');
    const contentHeader = page.locator('[data-testid="panel-header-content"]');
    await expect(contentHeader).toBeVisible();
    await expect(contentHeader).toContainText('OCR Transcript');
    await expect(contentHeader).toContainText('Immutable Tesseract');

    await switchTab(page, 'visual');
    const visualHeader = page.locator('[data-testid="panel-header-visual"]');
    await expect(visualHeader).toBeVisible();
    await expect(visualHeader).toContainText('Spatial Labeling');
    await expect(visualHeader).toContainText('field mapping interface');
  });

  test('has proper ARIA attributes', async ({ page }) => {
    await openWorkspace(page);

    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible();
    await expect(tablist).toHaveAttribute('aria-label', 'Context Sidebar Tabs');

    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    await expect(metadataTab).toHaveAttribute('role', 'tab');
    await expect(metadataTab).toHaveAttribute('aria-selected', 'true');
    await expect(metadataTab).toHaveAttribute('aria-controls', 'panel-metadata');

    const contentTab = page.locator('[data-testid="tab-content"]');
    await expect(contentTab).toHaveAttribute('aria-selected', 'false');

    const metadataPanel = page.locator('[data-testid="tab-panel-metadata"]');
    await expect(metadataPanel).toHaveAttribute('role', 'tabpanel');
    await expect(metadataPanel).toHaveAttribute('aria-labelledby', 'tab-metadata');
  });

  test('supports keyboard navigation between tabs', async ({ page }) => {
    await openWorkspace(page);

    const metadataTab = page.locator('[data-testid="tab-metadata"]');
    const contentTab = page.locator('[data-testid="tab-content"]');
    const chatTab = page.locator('[data-testid="tab-chat"]');

    await metadataTab.focus();

    await page.keyboard.press('ArrowRight');
    await expect(contentTab).toBeFocused();
    await expect(page.locator('[data-testid="tab-panel-content"]')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(chatTab).toBeFocused();
    await expect(page.locator('[data-testid="tab-panel-chat"]')).toBeVisible();

    await page.keyboard.press('ArrowLeft');
    await expect(contentTab).toBeFocused();
    await expect(page.locator('[data-testid="tab-panel-content"]')).toBeVisible();
  });

  test('shows debug tab when admin override is active', async ({ page }) => {
    await openWorkspace(page);
    const initialCount = await page.locator('[data-testid="tab-debug"]').count();

    await page.addInitScript(() => {
      (window as unknown as { __TEST_IS_ADMIN?: boolean }).__TEST_IS_ADMIN = true;
      try {
        localStorage.removeItem('paperless:context-sidebar.activeTab');
      } catch (_err) {
        // ignore localStorage errors
      }
    });

    await openWorkspace(page);
    const debugTab = page.locator('[data-testid="tab-debug"]');
    await expect(debugTab).toBeVisible();
    await expect(debugTab).toContainText(/Debug/i);
    await expect(debugTab.locator('.fa-bug')).toBeVisible();
    await expect(debugTab).toHaveAttribute('title', 'Developer debugging information');

    // If base user was non-admin, override must change visibility from 0 -> 1.
    if (initialCount === 0) {
      expect(await page.locator('[data-testid="tab-debug"]').count()).toBe(1);
    }
  });
});
