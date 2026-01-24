import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('ExpertModelsIsland smoke test', () => {
  test('island mounts and displays all tabs', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE}/settings#expert-models`, { waitUntil: 'networkidle' });

    // Wait for island to mount
    await page.waitForSelector('[data-island="expert-models-island"][data-mounted="true"]', { timeout: 10000 });

    // Verify root element
    await expect(page.locator('[data-testid="expert-models-root"]')).toBeVisible();

    // Verify heading
    await expect(page.locator('[data-testid="expert-models-root"] >> text=Expert Models Settings')).toBeVisible();

    // Verify expert pipeline toggle
    await expect(page.locator('[data-testid="expert-pipeline-toggle"]')).toBeVisible();

    // Verify all 3 tabs are present
    await expect(page.locator('[data-testid="tab-medical"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-financial"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-legal"]')).toBeVisible();

    // Verify save button is present
    await expect(page.locator('[data-testid="save-button"]')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-expert-models/screenshot-initial.png',
      fullPage: true
    });

    // Assert no console errors
    expect(consoleErrors, 'no console errors during mount').toEqual([]);
  });

  test('tab navigation switches content correctly', async ({ page }) => {
    await page.goto(`${BASE}/settings#expert-models`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="expert-models-island"][data-mounted="true"]', { timeout: 10000 });

    // Default tab should be Medical
    await expect(page.locator('[data-testid="tab-content-medical"]')).toBeVisible();

    // Click Financial tab
    await page.click('[data-testid="tab-financial"]');
    await expect(page.locator('[data-testid="tab-content-financial"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-content-medical"]')).not.toBeVisible();

    // Click Legal tab
    await page.click('[data-testid="tab-legal"]');
    await expect(page.locator('[data-testid="tab-content-legal"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-content-financial"]')).not.toBeVisible();

    // Return to Medical tab
    await page.click('[data-testid="tab-medical"]');
    await expect(page.locator('[data-testid="tab-content-medical"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-content-legal"]')).not.toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-expert-models/screenshot-tab-navigation.png',
      fullPage: true
    });
  });

  test('expert pipeline toggle works', async ({ page }) => {
    await page.goto(`${BASE}/settings#expert-models`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="expert-models-island"][data-mounted="true"]', { timeout: 10000 });

    const toggle = page.locator('[data-testid="expert-pipeline-toggle"]');

    // Verify toggle is initially checked (default: true)
    await expect(toggle).toBeChecked();

    // Save button should be disabled (not dirty)
    await expect(page.locator('[data-testid="save-button"]')).toBeDisabled();

    // Toggle off
    await toggle.click();
    await expect(toggle).not.toBeChecked();

    // Save button should be enabled (dirty)
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="save-button"]')).toBeEnabled();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-expert-models/screenshot-pipeline-toggle.png',
      fullPage: true
    });
  });

  test('medical tab: all fields work', async ({ page }) => {
    await page.goto(`${BASE}/settings#expert-models`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="expert-models-island"][data-mounted="true"]', { timeout: 10000 });

    // Medical tab should be active by default
    await expect(page.locator('[data-testid="tab-content-medical"]')).toBeVisible();

    // Verify all medical model fields
    await expect(page.locator('[data-testid="medical-vision-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="medical-analysis-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="medical-radiology-input"]')).toBeVisible();

    // Fill in medical models
    await page.fill('[data-testid="medical-vision-input"]', 'llava-med-v2.0');
    await page.fill('[data-testid="medical-analysis-input"]', 'medtext-llama3.1');
    await page.fill('[data-testid="medical-radiology-input"]', 'llava-med-radiology');

    // Save button should be enabled (dirty)
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="save-button"]')).toBeEnabled();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-expert-models/screenshot-medical-config.png',
      fullPage: true
    });
  });

  test('financial tab: all fields work', async ({ page }) => {
    await page.goto(`${BASE}/settings#expert-models`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="expert-models-island"][data-mounted="true"]', { timeout: 10000 });

    // Click Financial tab
    await page.click('[data-testid="tab-financial"]');

    // Verify all financial model fields
    await expect(page.locator('[data-testid="financial-analysis-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="financial-reasoning-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="financial-vision-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="financial-vat-input"]')).toBeVisible();

    // Fill in financial models
    await page.fill('[data-testid="financial-analysis-input"]', 'fino2-8b');
    await page.fill('[data-testid="financial-reasoning-input"]', 'llm-pro-finance-v2');
    await page.fill('[data-testid="financial-vision-input"]', 'financial-vision-v2');
    await page.fill('[data-testid="financial-vat-input"]', 'vat-expert-v2');

    // Save button should be enabled (dirty)
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="save-button"]')).toBeEnabled();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-expert-models/screenshot-financial-config.png',
      fullPage: true
    });
  });

  test('legal tab: all fields work including optional orchestrator', async ({ page }) => {
    await page.goto(`${BASE}/settings#expert-models`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="expert-models-island"][data-mounted="true"]', { timeout: 10000 });

    // Click Legal tab
    await page.click('[data-testid="tab-legal"]');

    // Verify all legal model fields
    await expect(page.locator('[data-testid="legal-vision-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="legal-analysis-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="legal-orchestrator-input"]')).toBeVisible();

    // Fill in legal models
    await page.fill('[data-testid="legal-vision-input"]', 'qwen3-vl:latest');
    await page.fill('[data-testid="legal-analysis-input"]', 'gpt-oss-v2');
    await page.fill('[data-testid="legal-orchestrator-input"]', 'nemotron-orchestrator:8b');

    // Save button should be enabled (dirty)
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="save-button"]')).toBeEnabled();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-expert-models/screenshot-legal-config.png',
      fullPage: true
    });
  });

  test('save button shows loading state and dispatches events', async ({ page }) => {
    await page.goto(`${BASE}/settings#expert-models`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="expert-models-island"][data-mounted="true"]', { timeout: 10000 });

    // Listen for settings events
    const events: string[] = [];
    await page.exposeFunction('logEvent', (eventName: string) => {
      events.push(eventName);
    });

    await page.evaluate(() => {
      document.addEventListener('settings:changed', () => {
        (window as any).logEvent('settings:changed');
      });
      document.addEventListener('settings:restart-required', () => {
        (window as any).logEvent('settings:restart-required');
      });
      document.addEventListener('settings:saved', () => {
        (window as any).logEvent('settings:saved');
      });
    });

    // Intercept save API call
    await page.route('**/settings/apply', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          requiresRestart: true
        })
      });
    });

    // Make form dirty
    await page.fill('[data-testid="medical-vision-input"]', 'llava-med-test');
    await page.waitForTimeout(100);

    // Click save button
    const saveButton = page.locator('[data-testid="save-button"]');
    await saveButton.click();

    // Verify loading state
    await expect(saveButton).toHaveText('Saving...');
    await expect(saveButton).toBeDisabled();

    // Wait for save to complete
    await page.waitForTimeout(400);

    // Verify button returns to normal
    await expect(saveButton).toHaveText('Save Settings');

    // Verify save message is displayed
    await expect(page.locator('[data-testid="save-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-message"] >> text=saved successfully')).toBeVisible();

    // Verify events were dispatched
    await page.waitForTimeout(100);
    expect(events).toContain('settings:changed');
    expect(events).toContain('settings:restart-required');
    expect(events).toContain('settings:saved');

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-expert-models/screenshot-save-success.png',
      fullPage: true
    });
  });

  test('save button disabled when form not dirty', async ({ page }) => {
    await page.goto(`${BASE}/settings#expert-models`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="expert-models-island"][data-mounted="true"]', { timeout: 10000 });

    // Initially, save button should be disabled (not dirty)
    await expect(page.locator('[data-testid="save-button"]')).toBeDisabled();

    // Make form dirty
    await page.fill('[data-testid="medical-vision-input"]', 'llava-med-modified');
    await page.waitForTimeout(100);

    // Now save button should be enabled
    await expect(page.locator('[data-testid="save-button"]')).toBeEnabled();
  });

  test('all three tabs maintain independent state', async ({ page }) => {
    await page.goto(`${BASE}/settings#expert-models`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="expert-models-island"][data-mounted="true"]', { timeout: 10000 });

    // Fill medical fields
    await page.fill('[data-testid="medical-vision-input"]', 'medical-test');

    // Switch to financial tab
    await page.click('[data-testid="tab-financial"]');
    await page.fill('[data-testid="financial-analysis-input"]', 'financial-test');

    // Switch to legal tab
    await page.click('[data-testid="tab-legal"]');
    await page.fill('[data-testid="legal-vision-input"]', 'legal-test');

    // Return to medical tab - verify value persisted
    await page.click('[data-testid="tab-medical"]');
    await expect(page.locator('[data-testid="medical-vision-input"]')).toHaveValue('medical-test');

    // Return to financial tab - verify value persisted
    await page.click('[data-testid="tab-financial"]');
    await expect(page.locator('[data-testid="financial-analysis-input"]')).toHaveValue('financial-test');

    // Return to legal tab - verify value persisted
    await page.click('[data-testid="tab-legal"]');
    await expect(page.locator('[data-testid="legal-vision-input"]')).toHaveValue('legal-test');
  });

  test('restart warning message is displayed', async ({ page }) => {
    await page.goto(`${BASE}/settings#expert-models`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="expert-models-island"][data-mounted="true"]', { timeout: 10000 });

    // Verify restart warning is visible
    await expect(page.locator('text=Changing expert models requires a restart')).toBeVisible();
  });
});
