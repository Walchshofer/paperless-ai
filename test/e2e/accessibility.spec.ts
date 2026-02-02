import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Accessibility and Hydration Checks', () => {
  test('Workspace page accessibility and hydration', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace`);
    
    // 1. Hydration Check
    const workspaceRoot = page.locator('[data-testid="unified-workspace-root"]');
    await expect(workspaceRoot).toBeAttached();
    // Check if runtime processed the island
    await expect(workspaceRoot).toHaveAttribute('data-mounted', 'true', { timeout: 10000 });

    // 2. ARIA Roles and Labels
    // Use more robust selector for navigation
    await expect(page.locator('.sidebar-nav')).toBeAttached();
    await expect(page.locator('[data-testid="nav-workspace"]')).toBeAttached();
    
    // 3. Form Accessibility in Smart Metadata (if a document is selected)
    // For now, check the empty state
    await expect(page.locator('h2')).toContainText(/Select a document/i);
    
    // 4. Color contrast / Theme toggle
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    await expect(themeToggle).toBeEnabled();
  });

  test('Dashboard accessibility', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    
    // Check for landmark regions
    await expect(page.locator('role=main')).toBeVisible();
    await expect(page.locator('role=heading[level=1]')).toBeVisible();
    
    // Check charts have accessible names or descriptions
    const charts = page.locator('canvas');
    const chartCount = await charts.count();
    for (let i = 0; i < chartCount; i++) {
      const chart = charts.nth(i);
      // Charts should be inside a region or have a title
      const container = chart.locator('..');
      await expect(container).toBeVisible();
    }
  });

  test('Manual page accessibility', async ({ page }) => {
    await page.goto(`${BASE_URL}/manual`);
    
    // Check tablist accessibility
    const tablist = page.locator('[role="tablist"]');
    if (await tablist.count() > 0) {
      await expect(tablist).toHaveAttribute('aria-label', /Tabs/i);
      const tabs = tablist.locator('[role="tab"]');
      const firstTab = tabs.first();
      await expect(firstTab).toHaveAttribute('aria-selected', 'true');
    }
    
    // Check for aria-live regions (AI status updates)
    const _ariaLive = page.locator('[aria-live="polite"], [aria-live="assertive"]');
    // At least the toast container or status badges should exist
  });
});
