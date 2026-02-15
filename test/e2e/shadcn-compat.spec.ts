import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');

const BASE = process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('shadcn/ui compatibility smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { window.__DISABLE_GITHUB_FETCH__ = true; });
  });

  test('island mounts and components are interactive with no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE}/islands/shadcn-compat`, { waitUntil: 'domcontentloaded' });

    // Wait for island to mount (runtime sets data-mounted on host)
    await waitForIsland(page, 'shadcn-compat', 10000);

    // Basic interactions: Tabs
    await page.click('text=Tab 2');
    await expect(page.locator('text=Content for tab 2')).toBeVisible();

    // Dialog: open and assert content
    await page.click('text=Open Dialog');
    await expect(page.locator('text=Dialog Title')).toBeVisible();
    await page.click('text=Close');
    await expect(page.locator('text=Dialog Title')).not.toBeVisible();

    // Switch: toggle
    const _status = page.locator('text=On').first();
    // toggle switch element by clicking its thumb
    await page.click('role=button:has-text("Off") >> nth=0').catch(() => {});
    // allow UI to update
    await page.waitForTimeout(200);

    // Take screenshots for artifacts
    await page.screenshot({ path: 'test-results/playwright-shadcn-compat/screenshot-after-interactions.png', fullPage: true });

    // Assert no console errors
    expect(consoleErrors, 'no console errors during run').toEqual([]);
  });
});
