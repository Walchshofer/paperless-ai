import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('OverviewDashboardIsland smoke test', () => {
  test('island mounts and displays summary cards with no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected external API errors (GitHub stars, etc.)
        if (text.includes('stars count') || text.includes('repo info') || text.includes('403')) {
          return;
        }
        consoleErrors.push(text);
      }
    });

    // Navigate to settings overview page
    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });

    // Wait for island to mount (runtime sets data-mounted on host)
    await page.waitForSelector('[data-island="overview-dashboard-island"][data-mounted="true"]', { timeout: 10000 });

    // Use scoped locator for the overview dashboard island
    const dashboard = page.locator('[data-testid="overview-dashboard-root"]');

    // Verify overview dashboard title is visible
    await expect(dashboard.locator('text=Settings Overview')).toBeVisible();

    // Verify all summary cards are present within the dashboard
    await expect(dashboard.locator('h3:has-text("Connection")')).toBeVisible();
    await expect(dashboard.locator('h3:has-text("AI Provider")')).toBeVisible();
    await expect(dashboard.locator('h3:has-text("Expert Models")')).toBeVisible();
    await expect(dashboard.locator('h3:has-text("Advanced")')).toBeVisible();

    // Verify quick actions section is present within the dashboard
    await expect(dashboard.locator('text=Quick Actions')).toBeVisible();
    await expect(dashboard.locator('button:has-text("Export Settings")')).toBeVisible();
    await expect(dashboard.locator('button:has-text("Test Connection")')).toBeVisible();

    // Test navigation button on Connection card within dashboard - find first Configure button
    const configureButton = dashboard.locator('button:has-text("Configure")').first();
    await expect(configureButton).toBeVisible();

    // Take screenshot for artifacts
    await page.screenshot({
      path: 'test-results/playwright-overview-dashboard/screenshot-initial.png',
      fullPage: true
    });

    // Click configure button and verify hash navigation
    await configureButton.click();
    await page.waitForTimeout(200);

    // Verify URL hash changed
    expect(page.url()).toContain('#connection');

    // Take screenshot after interaction
    await page.screenshot({
      path: 'test-results/playwright-overview-dashboard/screenshot-after-navigation.png',
      fullPage: true
    });

    // Assert no console errors
    expect(consoleErrors, 'no console errors during run').toEqual([]);
  });
});
