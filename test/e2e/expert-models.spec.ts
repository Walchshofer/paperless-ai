import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');

const BASE =
  process.env.PLAYWRIGHT_BASE_URL
  || process.env.PAPERLESS_BASE_URL
  || 'http://localhost:3000';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__DISABLE_GITHUB_FETCH__ = true;
  });
});

async function gotoAiProvider(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/settings#ai-provider`, { waitUntil: 'domcontentloaded' });
  await waitForIsland(page, 'ai-provider-island', 10000);
  await expect(page.locator('[data-testid="ai-provider-root"]')).toBeVisible();
}

async function selectProvider(
  page: import('@playwright/test').Page,
  provider: 'openai' | 'ollama' | 'custom' | 'azure'
) {
  await page.click('[data-testid="tab-general"]');
  await expect(page.locator('[data-testid="tab-content-general"]')).toBeVisible();
  await page.selectOption('[data-testid="provider-select"]', provider);
  await page.waitForTimeout(150);
}

async function openExpertLabsSection(page: import('@playwright/test').Page) {
  await page.click('[data-testid="tab-ollama"]');
  await expect(page.locator('[data-testid="tab-content-ollama"]')).toBeVisible();

  const sectionToggle = page.locator('[data-testid="section-experts"] button[aria-expanded]');
  await expect(sectionToggle).toBeVisible();
  if ((await sectionToggle.getAttribute('aria-expanded')) !== 'true') {
    await sectionToggle.click();
  }
  await expect(sectionToggle).toHaveAttribute('aria-expanded', 'true');
}

test.describe('AI Provider Expert Labs', () => {
  test('mounts ai-provider island and displays all provider tabs', async ({ page }) => {
    await gotoAiProvider(page);

    await expect(page.locator('[data-testid="tab-general"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-openai"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-ollama"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-custom"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-azure"]')).toBeVisible();
  });

  test('locks expert labs when provider is not ollama', async ({ page }) => {
    await gotoAiProvider(page);
    await selectProvider(page, 'openai');
    await openExpertLabsSection(page);

    await expect(page.locator('text=Expert Laboratories Locked')).toBeVisible();
    await expect(page.locator('[data-testid="med-vision-card"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="fin-analysis-card"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="legal-vision-card"]')).toHaveCount(0);
  });

  test('shows expert model cards when provider is ollama', async ({ page }) => {
    await gotoAiProvider(page);
    await selectProvider(page, 'ollama');
    await openExpertLabsSection(page);

    await expect(page.locator('[data-testid="med-vision-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="fin-analysis-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="legal-vision-card"]')).toBeVisible();
  });

  test('marks form dirty after editing expert model and enables save', async ({ page }) => {
    await gotoAiProvider(page);
    await selectProvider(page, 'ollama');
    await openExpertLabsSection(page);

    const saveButton = page.locator('[data-testid="ai-provider-save-button"]');
    await page.fill('[data-testid="med-vision-input"]', 'qwen3-vl:8b');
    await page.waitForTimeout(100);

    await expect(saveButton).toBeEnabled();
  });

  test('save flow dispatches settings events and shows success message', async ({ page }) => {
    await gotoAiProvider(page);
    await selectProvider(page, 'ollama');
    await openExpertLabsSection(page);

    const events: string[] = [];
    await page.exposeFunction('logSettingsEvent', (name: string) => {
      events.push(name);
    });

    await page.evaluate(() => {
      document.addEventListener('settings:changed', () => {
        (
          window as unknown as {
            logSettingsEvent?: (_name: string) => void;
          }
        ).logSettingsEvent?.('settings:changed');
      });
      document.addEventListener('settings:saved', () => {
        (
          window as unknown as {
            logSettingsEvent?: (_name: string) => void;
          }
        ).logSettingsEvent?.('settings:saved');
      });
    });

    await page.route('**/api/settings/save', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, requiresRestart: true })
      });
    });

    await page.fill('[data-testid="med-vision-input"]', `qwen3-vl:8b-${Date.now()}`);
    const saveButton = page.locator('[data-testid="ai-provider-save-button"]');
    await expect(saveButton).toBeEnabled();

    await saveButton.click();
    await expect(page.locator('[data-testid="save-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-message"]')).toContainText(
      'synchronized successfully'
    );
    await expect(saveButton).toBeDisabled();

    await page.waitForTimeout(100);
    expect(events).toContain('settings:changed');
    expect(events).toContain('settings:saved');
  });

  test('provider toggle to openai locks experts, toggling back restores fields', async ({ page }) => {
    await gotoAiProvider(page);
    await selectProvider(page, 'ollama');
    await openExpertLabsSection(page);

    await page.fill('[data-testid="med-vision-input"]', 'persist-med-lab');

    await selectProvider(page, 'openai');
    await openExpertLabsSection(page);
    await expect(page.locator('text=Expert Laboratories Locked')).toBeVisible();

    await selectProvider(page, 'ollama');
    await openExpertLabsSection(page);
    await expect(page.locator('[data-testid="med-vision-input"]')).toHaveValue('persist-med-lab');
  });
});
