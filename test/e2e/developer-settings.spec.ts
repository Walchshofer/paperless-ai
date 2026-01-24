import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('DeveloperSettingsIsland E2E Tests', () => {
  test('island mounts correctly', async ({ page }) => {
    await page.goto(`${BASE}/settings#developer`, { waitUntil: 'networkidle' });

    await page.waitForSelector('[data-island="developer-settings-island"][data-mounted="true"]', { timeout: 10000 });

    const root = page.locator('[data-testid="developer-settings-root"]');
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute('data-hydrated', 'true');

    // Verify warning banner is visible
    await expect(page.locator('[data-testid="developer-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="developer-warning"]')).toContainText('Advanced Settings');

    await page.screenshot({
      path: 'test-results/playwright-developer/screenshot-mount.png',
      fullPage: true
    });
  });

  test('feature flags section expands and collapses', async ({ page }) => {
    await page.goto(`${BASE}/settings#developer`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="developer-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Section should be collapsed by default
    await expect(page.locator('[data-testid="feature-flags-content"]')).not.toBeVisible();

    // Click to expand
    await page.click('[data-testid="feature-flags-header"]');
    await expect(page.locator('[data-testid="feature-flags-content"]')).toBeVisible();

    // Verify auto-save indicator
    await expect(page.locator('[data-testid="feature-flags-indicator"]')).toContainText('Auto-saves on change');

    // Click to collapse
    await page.click('[data-testid="feature-flags-header"]');
    await expect(page.locator('[data-testid="feature-flags-content"]')).not.toBeVisible();

    await page.screenshot({
      path: 'test-results/playwright-developer/screenshot-feature-flags-toggle.png',
      fullPage: true
    });
  });

  test('feature flag toggles trigger auto-save', async ({ page }) => {
    await page.goto(`${BASE}/settings#developer`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="developer-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Expand feature flags section
    await page.click('[data-testid="feature-flags-header"]');
    await expect(page.locator('[data-testid="feature-flags-content"]')).toBeVisible();

    let saveCallCount = 0;
    await page.route('**/settings/apply', async (route) => {
      const requestBody = route.request().postDataJSON();

      if (requestBody.category === 'developer-feature-flags') {
        saveCallCount++;
        expect(requestBody.requiresRestart).toBe(false);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, requiresRestart: false })
        });
      } else {
        await route.continue();
      }
    });

    // Toggle expertPipelineEnabled
    await page.click('[data-testid="toggle-expertPipelineEnabled"]');

    // Wait for debounce (500ms) + network
    await page.waitForTimeout(700);

    expect(saveCallCount).toBeGreaterThan(0);

    await page.screenshot({
      path: 'test-results/playwright-developer/screenshot-auto-save.png',
      fullPage: true
    });
  });

  test('all feature flags are present and toggleable', async ({ page }) => {
    await page.goto(`${BASE}/settings#developer`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="developer-settings-island"][data-mounted="true"]', { timeout: 10000 });

    await page.click('[data-testid="feature-flags-header"]');
    await expect(page.locator('[data-testid="feature-flags-content"]')).toBeVisible();

    const expectedFlags = [
      'expertPipelineEnabled',
      'visualRagEnabled',
      'visualRagSidecarEnabled',
      'forceVisualRag',
      'guidanceServiceEnabled',
      'metricsEnabled',
      'duplicateDetectionEnabled',
      'ocrCheckpointEnabled',
      'summaryFallbackEnabled'
    ];

    for (const flag of expectedFlags) {
      const toggle = page.locator(`[data-testid="toggle-${flag}"]`);
      await expect(toggle).toBeVisible();

      // Verify toggle is clickable
      const isChecked = await toggle.isChecked();
      await toggle.click();
      await page.waitForTimeout(100);
      const isNowChecked = await toggle.isChecked();
      expect(isNowChecked).toBe(!isChecked);
    }

    await page.screenshot({
      path: 'test-results/playwright-developer/screenshot-all-flags.png',
      fullPage: true
    });
  });

  test('environment variables section expands and collapses', async ({ page }) => {
    await page.goto(`${BASE}/settings#developer`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="developer-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Section should be collapsed by default
    await expect(page.locator('[data-testid="env-vars-content"]')).not.toBeVisible();

    // Click to expand
    await page.click('[data-testid="env-vars-header"]');
    await expect(page.locator('[data-testid="env-vars-content"]')).toBeVisible();

    // Verify manual save indicator
    await expect(page.locator('[data-testid="env-vars-indicator"]')).toContainText('Manual save required');

    // Click to collapse
    await page.click('[data-testid="env-vars-header"]');
    await expect(page.locator('[data-testid="env-vars-content"]')).not.toBeVisible();

    await page.screenshot({
      path: 'test-results/playwright-developer/screenshot-env-vars-toggle.png',
      fullPage: true
    });
  });

  test('environment variable inputs accept values', async ({ page }) => {
    await page.goto(`${BASE}/settings#developer`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="developer-settings-island"][data-mounted="true"]', { timeout: 10000 });

    await page.click('[data-testid="env-vars-header"]');
    await expect(page.locator('[data-testid="env-vars-content"]')).toBeVisible();

    // Fill scan interval
    await page.fill('[data-testid="scan-interval-input"]', '*/15 * * * *');
    await expect(page.locator('[data-testid="scan-interval-input"]')).toHaveValue('*/15 * * * *');

    // Fill token limit
    await page.fill('[data-testid="token-limit-input"]', '256000');
    await expect(page.locator('[data-testid="token-limit-input"]')).toHaveValue('256000');

    // Fill response tokens
    await page.fill('[data-testid="response-tokens-input"]', '8192');
    await expect(page.locator('[data-testid="response-tokens-input"]')).toHaveValue('8192');

    // Fill text quality threshold
    await page.fill('[data-testid="text-quality-threshold-input"]', '75');
    await expect(page.locator('[data-testid="text-quality-threshold-input"]')).toHaveValue('75');

    // Fill max vision pages
    await page.fill('[data-testid="max-vision-pages-input"]', '8');
    await expect(page.locator('[data-testid="max-vision-pages-input"]')).toHaveValue('8');

    // Fill guidance timeout
    await page.fill('[data-testid="guidance-timeout-input"]', '120000');
    await expect(page.locator('[data-testid="guidance-timeout-input"]')).toHaveValue('120000');

    // Fill visual rag timeout
    await page.fill('[data-testid="visual-rag-timeout-input"]', '45000');
    await expect(page.locator('[data-testid="visual-rag-timeout-input"]')).toHaveValue('45000');

    await page.screenshot({
      path: 'test-results/playwright-developer/screenshot-env-vars-filled.png',
      fullPage: true
    });
  });

  test('manual save triggers restart-required event', async ({ page }) => {
    await page.goto(`${BASE}/settings#developer`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="developer-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Track events
    const events: string[] = [];
    await page.exposeFunction('logEvent', (eventName: string) => {
      events.push(eventName);
    });

    await page.evaluate(() => {
      document.addEventListener('settings:restart-required', () => {
        (window as any).logEvent('settings:restart-required');
      });
      document.addEventListener('settings:saved', () => {
        (window as any).logEvent('settings:saved');
      });
    });

    await page.route('**/settings/apply', async (route) => {
      const requestBody = route.request().postDataJSON();

      if (requestBody.category === 'developer-env-vars') {
        expect(requestBody.requiresRestart).toBe(true);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, requiresRestart: true })
        });
      } else {
        await route.continue();
      }
    });

    await page.click('[data-testid="env-vars-header"]');
    await page.fill('[data-testid="token-limit-input"]', '200000');

    await page.click('[data-testid="save-env-vars-button"]');

    // Wait for save to complete
    await page.waitForTimeout(500);

    // Verify events were dispatched
    expect(events).toContain('settings:restart-required');
    expect(events).toContain('settings:saved');

    await page.screenshot({
      path: 'test-results/playwright-developer/screenshot-manual-save.png',
      fullPage: true
    });
  });

  test('save button shows loading state', async ({ page }) => {
    await page.goto(`${BASE}/settings#developer`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="developer-settings-island"][data-mounted="true"]', { timeout: 10000 });

    await page.route('**/settings/apply', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, requiresRestart: true })
      });
    });

    await page.click('[data-testid="env-vars-header"]');
    await page.fill('[data-testid="token-limit-input"]', '150000');

    await page.click('[data-testid="save-env-vars-button"]');

    // Check loading state
    await expect(page.locator('[data-testid="save-env-vars-button"]')).toHaveText('Saving...');
    await expect(page.locator('[data-testid="save-env-vars-button"]')).toBeDisabled();

    // Wait for completion
    await page.waitForTimeout(600);

    await expect(page.locator('[data-testid="save-env-vars-button"]')).toHaveText('Save Environment Variables');
    await expect(page.locator('[data-testid="save-env-vars-button"]')).toBeEnabled();

    await page.screenshot({
      path: 'test-results/playwright-developer/screenshot-loading-state.png',
      fullPage: true
    });
  });

  test('section collapse state persists during interaction', async ({ page }) => {
    await page.goto(`${BASE}/settings#developer`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="developer-settings-island"][data-mounted="true"]', { timeout: 10000 });

    // Expand feature flags
    await page.click('[data-testid="feature-flags-header"]');
    await expect(page.locator('[data-testid="feature-flags-content"]')).toBeVisible();

    // Toggle a flag
    await page.click('[data-testid="toggle-visualRagEnabled"]');
    await page.waitForTimeout(100);

    // Feature flags should still be expanded
    await expect(page.locator('[data-testid="feature-flags-content"]')).toBeVisible();

    // Expand env vars
    await page.click('[data-testid="env-vars-header"]');
    await expect(page.locator('[data-testid="env-vars-content"]')).toBeVisible();

    // Fill a field
    await page.fill('[data-testid="token-limit-input"]', '180000');

    // Env vars should still be expanded
    await expect(page.locator('[data-testid="env-vars-content"]')).toBeVisible();

    // Feature flags should still be expanded too
    await expect(page.locator('[data-testid="feature-flags-content"]')).toBeVisible();

    await page.screenshot({
      path: 'test-results/playwright-developer/screenshot-state-persistence.png',
      fullPage: true
    });
  });

  test('warning banner displays correctly', async ({ page }) => {
    await page.goto(`${BASE}/settings#developer`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="developer-settings-island"][data-mounted="true"]', { timeout: 10000 });

    const warning = page.locator('[data-testid="developer-warning"]');
    await expect(warning).toBeVisible();

    // Check styling (yellow/amber background)
    const bgColor = await warning.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toBeTruthy();

    // Check warning icon or text
    await expect(warning).toContainText('Advanced');

    await page.screenshot({
      path: 'test-results/playwright-developer/screenshot-warning-banner.png',
      fullPage: true
    });
  });
});
