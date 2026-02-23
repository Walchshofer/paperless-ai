import { test, expect, type Response } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = 'test-results/settings-routes-verify';

test.describe('Settings routes - full visual verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { window.__DISABLE_GITHUB_FETCH__ = true; });
  });

  test('diagnose AI Provider loading issue', async ({ page }) => {
    const allConsole: string[] = [];
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      allConsole.push(`[${msg.type()}] ${msg.text()}`);
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Intercept /api/settings/config to see the response
    let apiResponse: { status: number; body: string } | null = null;
    page.on('response', async (response: Response) => {
      if (response.url().includes('/api/settings/config')) {
        apiResponse = {
          status: response.status(),
          body: await response.text().catch(() => 'FAILED_TO_READ')
        };
      }
    });

    const response = await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    // Wait for sidebar
    await waitForIsland(page, 'settings-sidebar-island', 15000);

    // Click AI Provider
    await page.click('[data-testid="category-ai-provider"]');
    await page.waitForTimeout(2000);

    // Capture diagnostic info
    const diagnostics = await page.evaluate(() => {
      const island = document.querySelector('[data-island="ai-provider-island"]');
      const loading = document.querySelector('[data-testid="ai-provider-loading"]');
      const root = document.querySelector('[data-testid="ai-provider-root"]');
      return {
        islandExists: !!island,
        islandMounted: island?.getAttribute('data-mounted'),
        islandInnerHTML: island?.innerHTML?.substring(0, 500),
        loadingVisible: !!loading,
        rootVisible: !!root,
        sectionHidden: document.querySelector('[data-testid="settings-section-ai-provider"]')?.classList.contains('hidden'),
      };
    });

    // Wait a bit more to catch the API response
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/diag-ai-provider.png`, fullPage: true });

    // Print diagnostics
    console.log('\n=== DIAGNOSTICS ===');
    console.log('API Response:', JSON.stringify(apiResponse, null, 2));
    console.log('Island State:', JSON.stringify(diagnostics, null, 2));
    console.log('Console Errors:', consoleErrors);
    console.log('All Console:', allConsole.filter(l => l.includes('AIProvider') || l.includes('island') || l.includes('error') || l.includes('Error')));
    console.log('===================\n');

    // The test: AI Provider root should eventually appear (not stuck in loading)
    if (diagnostics.loadingVisible && !diagnostics.rootVisible) {
      // Still loading — test will fail with diagnostics
      console.log('STILL STUCK IN LOADING — investigate API response and console output above');
    }

    // Assert we're not permanently stuck
    const aiRoot = page.locator('[data-testid="ai-provider-root"]');
    await expect(aiRoot).toBeVisible({ timeout: 10000 });
  });

  test('settings page loads and all sidebar categories navigate correctly', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          text.includes('api.github.com') ||
          text.includes('Failed to fetch stars') ||
          text.includes('Failed to load resource') ||
          text.includes('net::ERR_') ||
          text.includes('favicon')
        ) return;
        consoleErrors.push(text);
      }
    });

    // 1. Navigate to settings page
    const response = await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    // 2. Wait for sidebar island to mount
    const sidebarMounted = await waitForIsland(page, 'settings-sidebar-island', 15000);
    expect(sidebarMounted).toBe(true);

    // 3. Verify sidebar root is visible
    await expect(page.locator('[data-testid="settings-sidebar-root"]')).toBeVisible();

    // 4. Screenshot: initial state (Overview active)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-overview.png`, fullPage: true });

    // 5. Verify overview dashboard island is mounted
    const overviewMounted = await waitForIsland(page, 'overview-dashboard-island', 10000);
    expect(overviewMounted).toBe(true);
    await expect(page.locator('[data-testid="overview-dashboard-root"]')).toBeVisible();

    // --- Click Connection ---
    await page.click('[data-testid="category-connection"]');
    await page.waitForTimeout(500);
    const connectionMounted = await waitForIsland(page, 'connection-settings-island', 10000);
    expect(connectionMounted).toBe(true);
    const connectionSection = page.locator('[data-testid="settings-section-connection"]');
    await expect(connectionSection).not.toHaveClass(/hidden/);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-connection.png`, fullPage: true });

    // --- Click AI Provider ---
    await page.click('[data-testid="category-ai-provider"]');
    await page.waitForTimeout(500);
    const aiProviderMounted = await waitForIsland(page, 'ai-provider-island', 10000);
    expect(aiProviderMounted).toBe(true);
    const aiProviderSection = page.locator('[data-testid="settings-section-ai-provider"]');
    await expect(aiProviderSection).not.toHaveClass(/hidden/);
    // Wait for root to appear (not stuck in loading)
    await expect(page.locator('[data-testid="ai-provider-root"]')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-ai-provider.png`, fullPage: true });

    // --- Enable Developer Mode ---
    const devToggle = page.locator('[data-testid="developer-toggle"]');
    if (await devToggle.isVisible()) {
      await devToggle.click();
      await page.waitForTimeout(300);
    }

    // --- Click Advanced (Presets) ---
    const advancedCategory = page.locator('[data-testid="category-advanced"]');
    if (await advancedCategory.isVisible()) {
      await advancedCategory.click();
      await page.waitForTimeout(500);
      const presetsMounted = await waitForIsland(page, 'presets-manager-island', 10000);
      expect(presetsMounted).toBe(true);
      const advancedSection = page.locator('[data-testid="settings-section-advanced"]');
      await expect(advancedSection).not.toHaveClass(/hidden/);
      await expect(page.locator('[data-testid="presets-manager-root"]')).toBeVisible();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/04-advanced-presets.png`, fullPage: true });
    }

    // --- Click Developer ---
    const developerCategory = page.locator('[data-testid="category-developer"]');
    if (await developerCategory.isVisible()) {
      await developerCategory.click();
      await page.waitForTimeout(500);
      const devMounted = await waitForIsland(page, 'developer-settings-island', 10000);
      expect(devMounted).toBe(true);
      const devSection = page.locator('[data-testid="settings-section-developer"]');
      await expect(devSection).not.toHaveClass(/hidden/);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/05-developer.png`, fullPage: true });
    }

    // --- Click Prompts ---
    const promptsCategory = page.locator('[data-testid="category-prompts"]');
    if (await promptsCategory.isVisible()) {
      await promptsCategory.click();
      await page.waitForTimeout(500);
      const promptsMounted = await waitForIsland(page, 'prompts-settings-island', 10000);
      expect(promptsMounted).toBe(true);
      const promptsSection = page.locator('[data-testid="settings-section-prompts"]');
      await expect(promptsSection).not.toHaveClass(/hidden/);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/06-prompts.png`, fullPage: true });
    }

    // --- Navigate back to Overview ---
    await page.click('[data-testid="category-overview"]');
    await page.waitForTimeout(300);
    const overviewSection = page.locator('[data-testid="settings-section-overview"]');
    await expect(overviewSection).not.toHaveClass(/hidden/);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-overview-return.png`, fullPage: true });

    // 6. Final assertion: no console errors
    const filteredErrors = consoleErrors.filter(e =>
      !e.includes('background fetch failed') &&
      !e.includes('Failed to fetch')
    );
    expect(filteredErrors, `Unexpected console errors: ${filteredErrors.join('; ')}`).toEqual([]);
  });
});
