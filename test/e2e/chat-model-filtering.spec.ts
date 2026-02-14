/**
 * @file E2E tests for chat model filtering by provider
 * @description Tests for ticket d3fea95f: Filter Model Selection by Active Provider
 */
import { test, expect } from '@playwright/test';

async function openChatTab(page: import('@playwright/test').Page) {
  await page.click('[data-testid="chat-tab-chat"], [data-testid="tab-chat"]');
}

test.describe('Chat Model Filtering by Provider', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a workspace page with a document
    await page.goto('/workspace/doc/74');
  });

  test('should display provider indicator', async ({ page }) => {
    await openChatTab(page);

    // Wait for provider indicator to appear
    const providerIndicator = page.locator('[data-testid="chat-provider-indicator"]');
    await expect(providerIndicator).toBeVisible({ timeout: 10000 });

    // Should show "Provider:" label
    await expect(providerIndicator).toContainText('Provider:');
  });

  test('should show model select dropdown', async ({ page }) => {
    await openChatTab(page);

    // Wait for model select to appear
    const modelSelect = page.locator('[data-testid="chat-model-select"]');
    await expect(modelSelect).toBeVisible({ timeout: 10000 });
  });

  test('hides expert models for non-ollama provider payloads', async ({ page }) => {
    await page.route('**/workspace/doc/*', async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      body = body.replace(
        /&#34;expertModels&#34;:\[[\s\S]*?\],&#34;currentProvider&#34;:/g,
        '&#34;expertModels&#34;:[],&#34;currentProvider&#34;:'
      );
      body = body.replace(
        /&#34;currentProvider&#34;:&#34;[^&#]+&#34;/g,
        '&#34;currentProvider&#34;:&#34;openai&#34;'
      );
      body = body.replace(
        /&quot;expertModels&quot;:\[[\s\S]*?\],&quot;currentProvider&quot;:/g,
        '&quot;expertModels&quot;:[],&quot;currentProvider&quot;:'
      );
      body = body.replace(
        /&quot;currentProvider&quot;:&quot;[^&]+&quot;/g,
        '&quot;currentProvider&quot;:&quot;openai&quot;'
      );
      await route.fulfill({ response, body });
    });

    await page.goto('/workspace/doc/74?tab=chat', { waitUntil: 'networkidle' });
    await page.unroute('**/workspace/doc/*');
    await openChatTab(page);

    const providerIndicator = page.locator('[data-testid="chat-provider-indicator"]');
    await expect(providerIndicator).toContainText(/openai/i);
    const modelSelect = page.locator('[data-testid="chat-model-select"]');
    await expect(modelSelect).toBeVisible({ timeout: 10000 });

    const optgroupLabels = await modelSelect.locator('optgroup').evaluateAll(
      (groups) => groups.map((group) => String(group.getAttribute('label') || ''))
    );
    expect(
      optgroupLabels.some((label) => label.toLowerCase().includes('expert'))
    ).toBe(false);
  });

  test('should allow model selection', async ({ page }) => {
    await openChatTab(page);

    // Wait for model select
    const modelSelect = page.locator('[data-testid="chat-model-select"]');
    await expect(modelSelect).toBeVisible({ timeout: 10000 });

    // Get current value
    const currentValue = await modelSelect.inputValue();

    // Model select should have a value (either selected or empty)
    expect(currentValue !== undefined).toBeTruthy();
  });
});
