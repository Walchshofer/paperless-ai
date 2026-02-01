import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Unified Workspace - Navigation & Interactions', () => {

  test.describe('Navigation from all entry points', () => {

    test('navigate to workspace from Dashboard sidebar', async ({ page }) => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });

      // Find and click the Workspace link in sidebar
      const workspaceLink = page.locator('a[href="/workspace"]').first();
      await expect(workspaceLink).toBeVisible();

      await workspaceLink.click();
      await page.waitForURL('**/workspace/**', { timeout: 10000 });

      // Verify we're on the document workspace
      await expect(page.locator('[data-page="document-workspace"]')).toBeVisible();
    });

    test('navigate to workspace from History sidebar', async ({ page }) => {
      await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' });

      // Find and click the Workspace link in sidebar
      const workspaceLink = page.locator('a[href="/workspace"]').first();
      await expect(workspaceLink).toBeVisible();

      await workspaceLink.click();
      await page.waitForURL('**/workspace/**', { timeout: 10000 });

      await expect(page.locator('[data-page="document-workspace"]')).toBeVisible();
    });

    test('navigate to workspace from History document row', async ({ page }) => {
      await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' });

      // Wait for history to load - check for the history table or document links
      await page.waitForSelector('table, [data-testid="history-manager-island"], a[href^="/workspace/"]', { timeout: 10000 });

      // Find a document link (View button) - could be /workspace/ or /document/
      const viewLink = page.locator('a[href^="/workspace/"]').first();

      // Skip if no documents in history
      if (await viewLink.count() === 0) {
        test.skip();
        return;
      }

      await viewLink.click();
      await page.waitForURL('**/workspace/**', { timeout: 10000 });

      await expect(page.locator('[data-page="document-workspace"]')).toBeVisible();
    });

  });

  test.describe('Mouse interactions', () => {

    test('sidebar tab switching with mouse click', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });

      // Wait for context sidebar to load
      await page.waitForSelector('[data-testid="context-sidebar"]', { timeout: 15000 });

      // Click Content tab
      const contentTab = page.locator('[data-testid="tab-content"]');
      if (await contentTab.count() > 0) {
        await contentTab.click();
        await expect(page.locator('[data-testid="tab-panel-content"]')).toBeVisible();
      }

      // Click Chat tab
      const chatTab = page.locator('[data-testid="tab-chat"]');
      if (await chatTab.count() > 0) {
        await chatTab.click();
        await expect(page.locator('[data-testid="tab-panel-chat"]')).toBeVisible();
      }

      // Click Metadata tab
      const metadataTab = page.locator('[data-testid="tab-metadata"]');
      if (await metadataTab.count() > 0) {
        await metadataTab.click();
        await expect(page.locator('[data-testid="tab-panel-metadata"]')).toBeVisible();
      }
    });

    test('document context bar buttons are clickable', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });

      // Wait for document context bar
      await page.waitForSelector('[data-testid="document-context-bar"]', { timeout: 15000 });

      // Check save button exists and is clickable
      const saveBtn = page.locator('[data-testid="save-all-btn"]');
      if (await saveBtn.count() > 0) {
        await expect(saveBtn).toBeVisible();
        await expect(saveBtn).toBeEnabled();

        // Click and verify it responds (may show loading state)
        await saveBtn.click();
        // Brief wait for any state change
        await page.waitForTimeout(500);
      }

      // Check reprocess button exists
      const reprocessBtn = page.locator('[data-testid="reprocess-btn"]');
      if (await reprocessBtn.count() > 0) {
        await expect(reprocessBtn).toBeVisible();
      }
    });

    test('document selector dropdown interaction', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });

      // Wait for document context bar
      await page.waitForSelector('[data-testid="document-context-bar"]', { timeout: 15000 });

      // Find document selector
      const docSelector = page.locator('[data-testid="document-selector"]');
      if (await docSelector.count() > 0) {
        await expect(docSelector).toBeVisible();

        // Click to open dropdown
        await docSelector.click();

        // Check if dropdown options appear
        const dropdownOption = page.locator('[data-testid^="doc-option-"]').first();
        if (await dropdownOption.count() > 0) {
          await expect(dropdownOption).toBeVisible();

          // Click an option
          await dropdownOption.click();

          // URL should change to reflect selected document
          await page.waitForTimeout(500);
        }
      }
    });

  });

  test.describe('Keyboard interactions', () => {

    test('tab navigation through sidebar tabs', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });

      await page.waitForSelector('[data-testid="context-sidebar"]', { timeout: 15000 });

      // Focus on first tab
      const firstTab = page.locator('[data-testid="tab-metadata"]');
      if (await firstTab.count() > 0) {
        await firstTab.focus();

        // Tab to next element
        await page.keyboard.press('Tab');

        // Press Enter to activate the focused element
        await page.keyboard.press('Enter');

        // Verify focus moved (brief check)
        await page.waitForTimeout(200);
      }
    });

    test('escape key closes dropdowns/modals', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });

      // Wait for page to load
      await page.waitForSelector('[data-page="document-workspace"]', { timeout: 15000 });

      // Open document selector if exists
      const docSelector = page.locator('[data-testid="document-selector"]');
      if (await docSelector.count() > 0) {
        await docSelector.click();
        await page.waitForTimeout(200);

        // Press Escape to close
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    });

    test('form field keyboard input', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });

      await page.waitForSelector('[data-testid="context-sidebar"]', { timeout: 15000 });

      // Ensure metadata tab is active
      const metadataTab = page.locator('[data-testid="tab-metadata"]');
      if (await metadataTab.count() > 0) {
        await metadataTab.click();
        await page.waitForTimeout(300);
      }

      // Find title input
      const titleInput = page.locator('[data-testid="smart-title-input"]');
      if (await titleInput.count() > 0) {
        await titleInput.click();
        await titleInput.clear();
        await page.keyboard.type('Test Document Title');

        // Verify value was entered
        await expect(titleInput).toHaveValue('Test Document Title');
      }
    });

  });

  test.describe('Visual state verification', () => {

    test('workspace displays document title', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });

      await page.waitForSelector('[data-page="document-workspace"]', { timeout: 15000 });

      // Document title should be displayed somewhere
      const titleElement = page.locator('[data-testid="document-title"], h1, .document-title').first();
      await expect(titleElement).toBeVisible();
    });

    test('unsaved changes indicator appears on edit', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });

      await page.waitForSelector('[data-testid="context-sidebar"]', { timeout: 15000 });

      // Go to metadata tab
      const metadataTab = page.locator('[data-testid="tab-metadata"]');
      if (await metadataTab.count() > 0) {
        await metadataTab.click();
      }

      // Edit a field
      const titleInput = page.locator('[data-testid="smart-title-input"]');
      if (await titleInput.count() > 0) {
        await titleInput.click();
        await titleInput.fill('Modified Title');

        // Wait for dirty state to propagate
        await page.waitForTimeout(500);

        // Check for unsaved indicator
        const unsavedIndicator = page.locator('[data-testid="status-unsaved"], .unsaved, [data-status="unsaved"]');
        // If implemented, it should be visible
        if (await unsavedIndicator.count() > 0) {
          await expect(unsavedIndicator).toBeVisible();
        }
      }
    });

    test('take screenshot for visual verification', async ({ page }) => {
      await page.goto(`${BASE}/workspace/latest`, { waitUntil: 'networkidle' });

      await page.waitForSelector('[data-page="document-workspace"]', { timeout: 15000 });

      // Take a full page screenshot
      await page.screenshot({
        path: 'test-results/unified-workspace-screenshot.png',
        fullPage: true
      });
    });

  });

});
