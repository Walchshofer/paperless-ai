import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

// Ensure tests don't trigger external GitHub fetches which can cause console errors in CI
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.__DISABLE_GITHUB_FETCH__ = true; });
});

test.describe('AIProviderIsland smoke test', () => {
  test('island mounts and displays all tabs', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known external noise from GitHub stars fetch in CI
        if (text.includes('api.github.com') || text.includes('Failed to fetch stars') || text.includes('Failed to load resource')) return;
        consoleErrors.push(text);
      }
    });

    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });

    // Wait for island to mount
    await waitForIsland(page, 'ai-provider-island', 10000);

    // Verify root element
    await expect(page.locator('[data-testid="ai-provider-root"]')).toBeVisible();

    // Verify heading (use role-based locator to avoid matching paragraph text)
    await expect(page.locator('[data-testid="ai-provider-root"]').getByRole('heading', { name: 'AI Provider Settings' })).toBeVisible();

    // Verify all 5 tabs are present
    await expect(page.locator('[data-testid="tab-general"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-openai"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-ollama"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-custom"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-azure"]')).toBeVisible();

    // Verify a visible save button is present inside this island
    await expect(page.locator('[data-testid="ai-provider-root"] [data-testid="save-button"]:visible')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-ai-provider/screenshot-initial.png',
      fullPage: true
    });

    // Assert no console errors (excluding known external noise)
    expect(consoleErrors, 'no console errors during mount (excluding known external noise)').toEqual([]);
  });

  test('tab navigation switches content correctly', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    // Default tab should be General
    await expect(page.locator('[data-testid="tab-content-general"]')).toBeVisible();

    // Click OpenAI tab
    await page.click('[data-testid="tab-openai"]');
    await expect(page.locator('[data-testid="tab-content-openai"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-content-general"]')).not.toBeVisible();

    // Click Ollama tab
    await page.click('[data-testid="tab-ollama"]');
    await expect(page.locator('[data-testid="tab-content-ollama"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-content-openai"]')).not.toBeVisible();

    // Click Custom tab
    await page.click('[data-testid="tab-custom"]');
    await expect(page.locator('[data-testid="tab-content-custom"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-content-ollama"]')).not.toBeVisible();

    // Click Azure tab
    await page.click('[data-testid="tab-azure"]');
    await expect(page.locator('[data-testid="tab-content-azure"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-content-custom"]')).not.toBeVisible();

    // Return to General tab
    await page.click('[data-testid="tab-general"]');
    await expect(page.locator('[data-testid="tab-content-general"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-content-azure"]')).not.toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-ai-provider/screenshot-tab-navigation.png',
      fullPage: true
    });
  });

  test('general tab: provider selection works', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    // Verify provider select is visible
    const providerSelect = page.locator('[data-testid="provider-select"]');
    await expect(providerSelect).toBeVisible();

    // Change provider to Ollama
    await providerSelect.selectOption('ollama');
    await expect(providerSelect).toHaveValue('ollama');

    // Save button state can vary depending on initial configuration; ensure changes enable the visible save button in this island
    const visibleSaveBtn = page.locator('[data-testid="ai-provider-root"] [data-testid="save-button"]:visible');

    // After changing provider, save button should be enabled (dirty state)
    await providerSelect.selectOption('azure');
    await page.waitForTimeout(100);
    await expect(visibleSaveBtn).toBeEnabled();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-ai-provider/screenshot-provider-selection.png',
      fullPage: true
    });
  });

  test('openai tab: API key field works', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    // Click OpenAI tab
    await page.click('[data-testid="tab-openai"]');

    // Verify API key input
    const apiKeyInput = page.locator('[data-testid="openai-api-key-input"]');
    await expect(apiKeyInput).toBeVisible();

    // Fill in API key
    await apiKeyInput.fill('sk-test-key-123');
    await expect(apiKeyInput).toHaveValue('sk-test-key-123');

    // Save button should be enabled (dirty state) - target visible save button in this island
    const visibleSaveBtnOpenAI = page.locator('[data-testid="ai-provider-root"] [data-testid="save-button"]:visible');
    await page.waitForTimeout(100);
    await expect(visibleSaveBtnOpenAI).toBeEnabled();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-ai-provider/screenshot-openai-config.png',
      fullPage: true
    });
  });

  test('ollama tab: configuration fields work', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    // Click Ollama tab
    await page.click('[data-testid="tab-ollama"]');

    // Verify connection fields
    await expect(page.locator('[data-testid="ollama-api-url-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="ollama-text-model-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="ollama-vision-model-input"]')).toBeVisible();

    // Verify token limit fields (auto-save)
    await expect(page.locator('[data-testid="ollama-text-context-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="ollama-text-max-tokens-input"]')).toBeVisible();

    // Fill in API URL
    await page.fill('[data-testid="ollama-api-url-input"]', 'http://localhost:11434');

    // Fill in model names
    await page.fill('[data-testid="ollama-text-model-input"]', 'llama3.1:8b');
    await page.fill('[data-testid="ollama-vision-model-input"]', 'llava:latest');

    // Save button should be enabled (dirty state)
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="ai-provider-root"] [data-testid="save-button"]:visible')).toBeEnabled();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-ai-provider/screenshot-ollama-config.png',
      fullPage: true
    });
  });

  test('ollama tab: token limits trigger auto-save', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    // Intercept auto-save API call
    let autoSaveCalled = false;
    await page.route('**/settings/apply', async (route) => {
      const postData = route.request().postDataJSON();
      if (postData && postData.requiresRestart === false) {
        autoSaveCalled = true;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Click Ollama tab
    await page.click('[data-testid="tab-ollama"]');

    // Change token limit (should trigger auto-save after debounce)
    await page.fill('[data-testid="ollama-text-context-input"]', '100000');

    // Wait for debounce + auto-save
    await page.waitForTimeout(1500);

    // Verify auto-save was called
    expect(autoSaveCalled).toBe(true);
  });

  test('custom tab: all fields work', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    // Click Custom tab
    await page.click('[data-testid="tab-custom"]');

    // Verify all fields
    await expect(page.locator('[data-testid="custom-api-url-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="custom-api-key-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="custom-model-input"]')).toBeVisible();

    // Fill in custom provider config
    await page.fill('[data-testid="custom-api-url-input"]', 'https://api.example.com/v1');
    await page.fill('[data-testid="custom-api-key-input"]', 'custom-key-123');
    await page.fill('[data-testid="custom-model-input"]', 'custom-model-v1');

    // Save button should be enabled (scope to this island's visible save button)
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="ai-provider-root"] [data-testid="save-button"]:visible')).toBeEnabled();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-ai-provider/screenshot-custom-config.png',
      fullPage: true
    });
  });

  test('azure tab: all fields work', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    // Click Azure tab
    await page.click('[data-testid="tab-azure"]');

    // Verify all fields
    await expect(page.locator('[data-testid="azure-endpoint-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="azure-api-key-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="azure-deployment-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="azure-api-version-input"]')).toBeVisible();

    // Fill in Azure config
    await page.fill('[data-testid="azure-endpoint-input"]', 'https://my-resource.openai.azure.com');
    await page.fill('[data-testid="azure-api-key-input"]', 'azure-key-123');
    await page.fill('[data-testid="azure-deployment-input"]', 'gpt-4');
    await page.fill('[data-testid="azure-api-version-input"]', '2023-12-01');

    // Save button should be enabled (scope to this island's visible save button)
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="ai-provider-root"] [data-testid="save-button"]:visible')).toBeEnabled();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/playwright-ai-provider/screenshot-azure-config.png',
      fullPage: true
    });
  });

  test('save button shows loading state and dispatches events', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="ai-provider-island"][data-mounted="true"]', { timeout: 10000 });

    // Listen for settings events
    const events: string[] = [];
    await page.exposeFunction('logEvent', (eventName: string) => {
      events.push(eventName);
    });

    await page.evaluate(() => {
      document.addEventListener('settings:changed', () => {
        (window as unknown as { logEvent?: (s: string) => void }).logEvent?.('settings:changed');
      });
      document.addEventListener('settings:restart-required', () => {
        (window as unknown as { logEvent?: (s: string) => void }).logEvent?.('settings:restart-required');
      });
      document.addEventListener('settings:saved', () => {
        (window as unknown as { logEvent?: (s: string) => void }).logEvent?.('settings:saved');
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

    // Change provider to make form dirty
    await page.selectOption('[data-testid="provider-select"]', 'ollama');
    await page.waitForTimeout(100);

    // Click save button
    const saveButton = page.locator('[data-testid="ai-provider-root"] [data-testid="save-button"]');
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
      path: 'test-results/playwright-ai-provider/screenshot-save-success.png',
      fullPage: true
    });
  });

  test('save button reflects dirty state', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-island="ai-provider-island"][data-mounted="true"]', { timeout: 10000 });

    // Make form dirty
    await page.selectOption('[data-testid="provider-select"]', 'azure');
    await page.waitForTimeout(100);

    // Now save button should be enabled (scope to island)
    await expect(page.locator('[data-testid="ai-provider-root"] [data-testid="save-button"]:visible')).toBeEnabled();
  });
});
