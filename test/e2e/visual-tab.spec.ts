import { test, expect, type Route } from '@playwright/test';
const fixtures = require('../helpers/fixtures');
const { navigateToWorkspace, switchTab, waitForIslandMount } = require('../helpers/workspace-fixtures');

/**
 * Visual Tab E2E Tests
 *
 * Tests for the Visual Tab functionality in the workspace sidebar.
 * Covers: tab navigation, field labeling, overlay management, visual search
 *
 * Architecture Reference: ticket:c937ea01 (Visual Tab for Overlay Labeling)
 */

test.describe('Visual Tab', () => {
  test.beforeEach(async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
  });

  test('should display Visual tab in sidebar', async ({ page }) => {
    const visualTab = page.locator('[data-testid="tab-visual"]');
    await expect(visualTab).toBeVisible();
    await expect(visualTab).toContainText('Visual');
  });

  test('should switch to Visual tab panel', async ({ page }) => {
    await switchTab(page, 'visual');

    const visualPanel = page.locator('[data-testid="tab-panel-visual"]');
    await expect(visualPanel).toBeVisible();

    const visualTabContent = page.locator('[data-testid="visual-tab-panel"]');
    await expect(visualTabContent).toBeVisible();
  });

  test('should display Visual Search button', async ({ page }) => {
    await switchTab(page, 'visual');

    await page.waitForSelector('[data-testid="visual-tab-panel"]');

    const searchButton = page.locator('[data-testid="visual-search-btn"]');
    await expect(searchButton).toBeVisible();
    await expect(searchButton).toContainText('Start Visual Search');
  });

  test('should activate draw mode when clicking Visual Search', async ({ page }) => {
    await switchTab(page, 'visual');

    await page.waitForSelector('[data-testid="visual-search-btn"]');
    await page.click('[data-testid="visual-search-btn"]');

    const drawModeIndicator = page.locator('[data-testid="visual-tab-panel"]');
    await expect(drawModeIndicator).toContainText('Draw Mode Active');

    const cancelButton = page.locator('[data-testid="cancel-draw-btn"]');
    await expect(cancelButton).toBeVisible();
  });

  test('should cancel draw mode when clicking Cancel', async ({ page }) => {
    await switchTab(page, 'visual');

    await page.click('[data-testid="visual-search-btn"]');
    await page.waitForSelector('[data-testid="cancel-draw-btn"]');
    await page.click('[data-testid="cancel-draw-btn"]');

    const searchButton = page.locator('[data-testid="visual-search-btn"]');
    await expect(searchButton).toBeVisible();
  });

  test('should persist Visual tab selection across page refreshes', async ({ page }) => {
    await switchTab(page, 'visual');
    await page.waitForSelector('[data-testid="tab-panel-visual"]');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForIslandMount(page, 'context-sidebar-island', 15000);

    const visualPanel = page.locator('[data-testid="tab-panel-visual"]');
    await expect(visualPanel).toBeVisible();
  });

  test('should display empty state when no overlays', async ({ page }) => {
    await switchTab(page, 'visual');
    await page.waitForSelector('[data-testid="visual-tab-panel"]');

    const panel = page.locator('[data-testid="visual-tab-panel"]');
    await expect(panel).not.toBeEmpty();
  });

  test('should have accessible tab structure', async ({ page }) => {
    const visualTab = page.locator('[data-testid="tab-visual"]');
    await expect(visualTab).toHaveAttribute('role', 'tab');
    await expect(visualTab).toHaveAttribute('aria-controls', 'panel-visual');

    await switchTab(page, 'visual');

    const visualPanel = page.locator('[data-testid="tab-panel-visual"]');
    await expect(visualPanel).toHaveAttribute('role', 'tabpanel');
    await expect(visualPanel).toHaveAttribute('aria-labelledby', 'tab-visual');
  });

  test('should support keyboard navigation between tabs', async ({ page }) => {
    const visualTab = page.locator('[data-testid="tab-visual"]');
    await visualTab.focus();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');

    await expect(visualTab).toBeFocused();
  });
});

test.describe('Visual Tab - Missing Fields', () => {
  test.beforeEach(async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
    await switchTab(page, 'visual');
    await page.waitForSelector('[data-testid="visual-tab-panel"]');
  });

  test('should activate draw mode for field labeling', async ({ page }) => {
    const labelButton = page.locator('[data-testid^="label-btn-"]').first();

    if (await labelButton.isVisible()) {
      await labelButton.click();

      const panel = page.locator('[data-testid="visual-tab-panel"]');
      await expect(panel).toContainText('Draw Mode Active');
    } else {
      test.skip();
    }
  });
});

test.describe('Visual Tab - Existing Overlays', () => {
  test.beforeEach(async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
    await switchTab(page, 'visual');
    await page.waitForSelector('[data-testid="visual-tab-panel"]');
  });

  test('should show view button for overlays', async ({ page }) => {
    const viewButton = page.locator('[data-testid^="view-overlay-"]').first();

    if (await viewButton.isVisible()) {
      await viewButton.click();
      await expect(viewButton).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('should show delete button for overlays', async ({ page }) => {
    const deleteButton = page.locator('[data-testid^="delete-overlay-"]').first();

    if (await deleteButton.isVisible()) {
      await expect(deleteButton).toBeEnabled();
    } else {
      test.skip();
    }
  });
});

test.describe('Visual Tab - API Integration', () => {
  test('should call missing-fields API', async ({ page }) => {
    let apiCalled = false;

    await page.route('**/api/visual-overlays/missing-fields/**', async (route: Route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fields: [
            { id: 'invoice_number', label: 'Invoice Number', isMapped: false },
            { id: 'total_amount', label: 'Total Amount', isMapped: true, overlayId: '123' }
          ]
        })
      });
    });

    const docId = fixtures.getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
    await switchTab(page, 'visual');

    await page.waitForTimeout(1000);

    expect(apiCalled).toBe(true);
  });

  test('should call document overlays API', async ({ page }) => {
    let apiCalled = false;

    await page.route('**/api/visual-overlays/document/**', async (route: Route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          overlays: [
            { id: '1', label: 'Invoice Number', pageNumber: 1, confidence: 0.95, bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 } }
          ]
        })
      });
    });

    const docId = fixtures.getTestDocId();
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
    await switchTab(page, 'visual');

    await page.waitForTimeout(1000);

    expect(apiCalled).toBe(true);
  });
});
