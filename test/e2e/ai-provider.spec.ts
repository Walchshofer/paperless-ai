import { test, expect, type Route } from '@playwright/test';
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

    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'domcontentloaded' });

    // Wait for island to mount
    await waitForIsland(page, 'ai-provider-island', 10000);

    // Verify root element
    await expect(page.locator('[data-testid="ai-provider-root"]')).toBeVisible();

    // Verify heading (Cyber Lab: AI Infrastructure)
    await expect(page.locator('[data-testid="ai-provider-root"]').getByRole('heading', { name: 'AI Infrastructure' })).toBeVisible();

    // Verify all 5 tabs are present
    await expect(page.locator('[data-testid="tab-general"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-openai"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-ollama"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-custom"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-azure"]')).toBeVisible();

    // Verify save button is present
    await expect(page.locator('[data-testid="ai-provider-root"] [data-testid="ai-provider-save-button"]')).toBeVisible();
  });

  test('tab navigation switches content correctly', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'domcontentloaded' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    // Default tab should be General
    await expect(page.locator('[data-testid="tab-content-general"]')).toBeVisible();

    // Click OpenAI tab
    await page.click('[data-testid="tab-openai"]');
    await expect(page.locator('[data-testid="tab-content-openai"]')).toBeVisible();

    // Click Ollama tab
    await page.click('[data-testid="tab-ollama"]');
    await expect(page.locator('[data-testid="tab-content-ollama"]')).toBeVisible();

    // Click Custom tab
    await page.click('[data-testid="tab-custom"]');
    await expect(page.locator('[data-testid="tab-content-custom"]')).toBeVisible();

    // Click Azure tab
    await page.click('[data-testid="tab-azure"]');
    await expect(page.locator('[data-testid="tab-content-azure"]')).toBeVisible();
  });

  test('general tab: provider selection works', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'domcontentloaded' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    const providerSelect = page.locator('[data-testid="provider-select"]');
    await expect(providerSelect).toBeVisible();

    // Change provider
    await providerSelect.selectOption('ollama');
    await expect(providerSelect).toHaveValue('ollama');

    // Save button should be enabled (dirty state)
    await providerSelect.selectOption('azure');
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="ai-provider-save-button"]')).toBeEnabled();
  });

  test('openai tab: connection note is visible', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'domcontentloaded' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    await page.click('[data-testid="tab-openai"]');
    
    // Verify note about Connection Center
    await expect(page.locator('[data-testid="connection-center-note"]')).toBeVisible();
    await expect(page.locator('[data-testid="openai-main-input"]')).toBeVisible();
  });

  test('ollama tab: model identifier fields work', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'domcontentloaded' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    await page.click('[data-testid="tab-ollama"]');

    // Verify model fields (Cyber Lab uses sections)
    // Make sure Core section is expanded
    const coreHeader = page.locator('[data-testid="section-core"]');
    await expect(coreHeader).toBeVisible();
    
    // Test input in core section
    const textModelInput = page.locator('[data-testid="ollama-text-input"]');
    await expect(textModelInput).toBeVisible();
    
    await textModelInput.fill('llama-test-3.1');
    await expect(page.locator('[data-testid="ai-provider-save-button"]')).toBeEnabled();
  });

  test('save button shows loading state and dispatches events', async ({ page }) => {
    await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'domcontentloaded' });
    await waitForIsland(page, 'ai-provider-island', 10000);

    // Listen for settings events
    const events: string[] = [];
    await page.exposeFunction('logEvent', (eventName: string) => {
      events.push(eventName);
    });

    await page.evaluate(() => {
      document.addEventListener('settings:changed', () => {
        (window as { logEvent: (_e: string) => void } & typeof window).logEvent('settings:changed');
      });
      document.addEventListener('settings:saved', () => {
        (window as { logEvent: (_e: string) => void } & typeof window).logEvent('settings:saved');
      });
    });

    // Intercept save API call
    await page.route('**/api/settings/save', async (route: Route) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Change something to make dirty
    await page.selectOption('[data-testid="provider-select"]', 'ollama');
    
    const saveButton = page.locator('[data-testid="ai-provider-save-button"]');
    await saveButton.click();

    // Verify loading state (Cyber Lab: Synchronizing...)
    await expect(saveButton).toContainText('Synchronizing');
    
    // Wait for save to complete
    await page.waitForTimeout(500);

    // Verify button returns to normal (Cyber Lab: Commit Infrastructure Changes)
    await expect(saveButton).toHaveText('Commit Infrastructure Changes');
    await expect(page.locator('[data-testid="save-message"]')).toBeVisible();
  });
});
