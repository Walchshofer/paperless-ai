import { test, expect } from '@playwright/test';

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
    // Navigate to workspace with a test document
    // Assumes document ID 74 exists in the test environment
    await page.goto('/workspace/doc/74');
    
    // Wait for the page to fully load
    await page.waitForSelector('[data-testid="context-sidebar-root"]', { timeout: 30000 });
  });

  test('should display Visual tab in sidebar', async ({ page }) => {
    // Check that the Visual tab exists
    const visualTab = page.locator('[data-testid="tab-visual"]');
    await expect(visualTab).toBeVisible();
    await expect(visualTab).toContainText('Visual');
  });

  test('should switch to Visual tab panel', async ({ page }) => {
    // Click the Visual tab
    await page.click('[data-testid="tab-visual"]');
    
    // Check that the Visual tab panel is displayed
    const visualPanel = page.locator('[data-testid="tab-panel-visual"]');
    await expect(visualPanel).toBeVisible();
    
    // Check that the visual tab content is rendered
    const visualTabContent = page.locator('[data-testid="visual-tab-panel"]');
    await expect(visualTabContent).toBeVisible();
  });

  test('should display Visual Search button', async ({ page }) => {
    // Switch to Visual tab
    await page.click('[data-testid="tab-visual"]');
    
    // Wait for panel to load
    await page.waitForSelector('[data-testid="visual-tab-panel"]');
    
    // Check that Visual Search button is present
    const searchButton = page.locator('[data-testid="visual-search-btn"]');
    await expect(searchButton).toBeVisible();
    await expect(searchButton).toContainText('Start Visual Search');
  });

  test('should activate draw mode when clicking Visual Search', async ({ page }) => {
    // Switch to Visual tab
    await page.click('[data-testid="tab-visual"]');
    
    // Wait for panel to load
    await page.waitForSelector('[data-testid="visual-search-btn"]');
    
    // Click Visual Search button
    await page.click('[data-testid="visual-search-btn"]');
    
    // Check that draw mode indicator appears
    const drawModeIndicator = page.locator('[data-testid="visual-tab-panel"]');
    await expect(drawModeIndicator).toContainText('Draw Mode Active');
    
    // Cancel button should be visible
    const cancelButton = page.locator('[data-testid="cancel-draw-btn"]');
    await expect(cancelButton).toBeVisible();
  });

  test('should cancel draw mode when clicking Cancel', async ({ page }) => {
    // Switch to Visual tab
    await page.click('[data-testid="tab-visual"]');
    
    // Activate draw mode
    await page.click('[data-testid="visual-search-btn"]');
    
    // Wait for draw mode
    await page.waitForSelector('[data-testid="cancel-draw-btn"]');
    
    // Click Cancel
    await page.click('[data-testid="cancel-draw-btn"]');
    
    // Visual Search button should be visible again
    const searchButton = page.locator('[data-testid="visual-search-btn"]');
    await expect(searchButton).toBeVisible();
  });

  test('should persist Visual tab selection across page refreshes', async ({ page }) => {
    // Switch to Visual tab
    await page.click('[data-testid="tab-visual"]');
    
    // Wait for panel to load
    await page.waitForSelector('[data-testid="tab-panel-visual"]');
    
    // Reload the page
    await page.reload();
    
    // Wait for the page to fully load
    await page.waitForSelector('[data-testid="context-sidebar-root"]', { timeout: 30000 });
    
    // Check that Visual tab is still active (localStorage persistence)
    const visualPanel = page.locator('[data-testid="tab-panel-visual"]');
    await expect(visualPanel).toBeVisible();
  });

  test('should display empty state when no overlays', async ({ page }) => {
    // Switch to Visual tab
    await page.click('[data-testid="tab-visual"]');
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="visual-tab-panel"]');
    
    // The panel should either show fields or an empty state message
    const panel = page.locator('[data-testid="visual-tab-panel"]');
    
    // Panel should have some content
    await expect(panel).not.toBeEmpty();
  });

  test('should have accessible tab structure', async ({ page }) => {
    // Check ARIA attributes on tab
    const visualTab = page.locator('[data-testid="tab-visual"]');
    await expect(visualTab).toHaveAttribute('role', 'tab');
    await expect(visualTab).toHaveAttribute('aria-controls', 'panel-visual');
    
    // Click to activate
    await page.click('[data-testid="tab-visual"]');
    
    // Check panel ARIA attributes
    const visualPanel = page.locator('[data-testid="tab-panel-visual"]');
    await expect(visualPanel).toHaveAttribute('role', 'tabpanel');
    await expect(visualPanel).toHaveAttribute('aria-labelledby', 'tab-visual');
  });

  test('should support keyboard navigation between tabs', async ({ page }) => {
    // Focus on Visual tab
    const visualTab = page.locator('[data-testid="tab-visual"]');
    await visualTab.focus();
    
    // Press ArrowRight to move to next tab (if any)
    await page.keyboard.press('ArrowRight');
    
    // Press ArrowLeft to come back
    await page.keyboard.press('ArrowLeft');
    
    // Visual tab should be focused again
    await expect(visualTab).toBeFocused();
  });
});

test.describe('Visual Tab - Missing Fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace/doc/74');
    await page.waitForSelector('[data-testid="context-sidebar-root"]', { timeout: 30000 });
    await page.click('[data-testid="tab-visual"]');
    await page.waitForSelector('[data-testid="visual-tab-panel"]');
  });

  test('should activate draw mode for field labeling', async ({ page }) => {
    // Look for a Label button (may not exist if all fields are mapped)
    const labelButton = page.locator('[data-testid^="label-btn-"]').first();
    
    if (await labelButton.isVisible()) {
      // Click the Label button
      await labelButton.click();
      
      // Should show draw mode indicator
      const panel = page.locator('[data-testid="visual-tab-panel"]');
      await expect(panel).toContainText('Draw Mode Active');
    } else {
      // Skip if no unmapped fields
      test.skip();
    }
  });
});

test.describe('Visual Tab - Existing Overlays', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace/doc/74');
    await page.waitForSelector('[data-testid="context-sidebar-root"]', { timeout: 30000 });
    await page.click('[data-testid="tab-visual"]');
    await page.waitForSelector('[data-testid="visual-tab-panel"]');
  });

  test('should show view button for overlays', async ({ page }) => {
    // Look for any overlay view button
    const viewButton = page.locator('[data-testid^="view-overlay-"]').first();
    
    if (await viewButton.isVisible()) {
      // Clicking should trigger highlight event (we can't easily verify the visual)
      await viewButton.click();
      
      // The button should still be visible after clicking
      await expect(viewButton).toBeVisible();
    } else {
      // Skip if no overlays
      test.skip();
    }
  });

  test('should show delete button for overlays', async ({ page }) => {
    // Look for any overlay delete button
    const deleteButton = page.locator('[data-testid^="delete-overlay-"]').first();
    
    if (await deleteButton.isVisible()) {
      // Just check it's clickable (don't actually delete)
      await expect(deleteButton).toBeEnabled();
    } else {
      // Skip if no overlays
      test.skip();
    }
  });
});

test.describe('Visual Tab - API Integration', () => {
  test('should call missing-fields API', async ({ page }) => {
    // Set up request interception
    let apiCalled = false;
    
    await page.route('**/api/visual-overlays/missing-fields/**', async (route) => {
      apiCalled = true;
      // Return mock response
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
    
    await page.goto('/workspace/doc/74');
    await page.waitForSelector('[data-testid="context-sidebar-root"]', { timeout: 30000 });
    await page.click('[data-testid="tab-visual"]');
    
    // Wait a bit for API call
    await page.waitForTimeout(1000);
    
    expect(apiCalled).toBe(true);
  });

  test('should call document overlays API', async ({ page }) => {
    let apiCalled = false;
    
    await page.route('**/api/visual-overlays/document/**', async (route) => {
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
    
    await page.goto('/workspace/doc/74');
    await page.waitForSelector('[data-testid="context-sidebar-root"]', { timeout: 30000 });
    await page.click('[data-testid="tab-visual"]');
    
    await page.waitForTimeout(1000);
    
    expect(apiCalled).toBe(true);
  });
});
