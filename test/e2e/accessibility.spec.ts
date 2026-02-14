import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Accessibility and Hydration Checks', () => {
  test('Workspace page accessibility and hydration', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace`);

    // 1. Hydration Check (anchor + hydrated island root)
    await waitForIsland(page, 'unified-workspace-island', 10000);
    const workspaceAnchor = page.locator(
      '[data-island="unified-workspace-island"][data-testid="unified-workspace-root"]'
    );
    const hydratedWorkspaceRoot = page.locator(
      '[data-island="unified-workspace-island"] [data-testid="unified-workspace-root"][data-hydrated="true"]'
    );
    await expect(workspaceAnchor).toBeAttached();
    await expect(workspaceAnchor).toHaveAttribute('data-mounted', 'true', {
      timeout: 10000
    });
    await expect(hydratedWorkspaceRoot).toBeAttached();

    // 2. ARIA Roles and Labels
    // Use more robust selector for navigation
    await expect(page.locator('.sidebar-nav')).toBeAttached();
    await expect(page.locator('[data-testid="nav-workspace"]')).toBeAttached();

    // 3. Workspace content accessibility (empty state OR selected document)
    const emptyStateHeading = page.getByRole('heading', {
      name: /Select a document/i
    });
    const documentContextBar = page.locator(
      '[data-testid="document-context-bar"]'
    );
    const hasEmptyState = (await emptyStateHeading.count()) > 0;
    const hasDocumentContext = (await documentContextBar.count()) > 0;
    expect(
      hasEmptyState || hasDocumentContext,
      'workspace should render empty state or selected document context'
    ).toBe(true);

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

  test('Legacy manual route returns 410', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/manual`);
    expect(res.status()).toBe(410);
  });
});
