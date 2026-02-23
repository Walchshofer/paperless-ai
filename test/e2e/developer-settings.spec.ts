import { test, expect, Page, type Route } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');

const BASE =
  process.env.PLAYWRIGHT_BASE_URL
  || process.env.PAPERLESS_BASE_URL
  || 'http://localhost:3000';

const FLAG_ENV_KEYS = new Set([
  'EXPERT_PIPELINE_ENABLED',
  'ENABLE_VISUAL_RAG',
  'ENABLE_VISUAL_RAG_SIDECAR',
  'FORCE_VISUAL_RAG',
  'GUIDANCE_SERVICE_ENABLED',
  'ENABLE_MODEL_METRICS',
  'DUPLICATE_DETECTION_ENABLED',
  'OCR_CHECKPOINT_ENABLED',
  'SUMMARY_FALLBACK_ENABLED'
]);

async function openDeveloperSettings(page: Page) {
  await page.goto(`${BASE}/settings#developer`, { waitUntil: 'domcontentloaded' });
  await waitForIsland(page, 'developer-settings-island', 10000);
  await expect(page.locator('[data-testid="developer-settings-root"]'))
    .toBeVisible();
}

async function expandIfCollapsed(
  page: Page,
  headerTestId: string,
  contentTestId: string
) {
  const content = page.locator(`[data-testid="${contentTestId}"]`);
  if (!(await content.isVisible())) {
    await page.click(`[data-testid="${headerTestId}"]`);
  }
  await expect(content).toBeVisible();
}

async function clickToggle(page: Page, id: string) {
  await page.locator(`[data-testid="${id}"]`).click();
}

async function isToggleChecked(page: Page, id: string): Promise<boolean> {
  const value = await page.locator(`[data-testid="${id}"]`)
    .getAttribute('aria-checked');
  return value === 'true';
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__DISABLE_GITHUB_FETCH__ = true;
    try {
      localStorage.setItem('settings:developerMode', 'true');
    } catch {
      // Ignore storage errors in restricted environments.
    }
  });
});

test.describe('DeveloperSettingsIsland E2E Tests', () => {
  test.describe.configure({ timeout: 60000 });

  test('island mounts correctly', async ({ page }) => {
    await openDeveloperSettings(page);

    const warning = page.locator('[data-testid="developer-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('affect system behavior');
  });

  test('feature flags section expands and collapses', async ({ page }) => {
    await openDeveloperSettings(page);

    const flagsContent = page.locator('[data-testid="feature-flags-content"]');
    if (await flagsContent.isVisible()) {
      await page.click('[data-testid="feature-flags-header"]');
      await expect(flagsContent).not.toBeVisible();
    }

    await page.click('[data-testid="feature-flags-header"]');
    await expect(flagsContent).toBeVisible();
    await expect(page.locator('[data-testid="feature-flags-indicator"]'))
      .toContainText('Auto-saves');

    await page.click('[data-testid="feature-flags-header"]');
    await expect(flagsContent).not.toBeVisible();
  });

  test('feature flag toggles trigger auto-save', async ({ page }) => {
    await openDeveloperSettings(page);
    await expandIfCollapsed(
      page,
      'feature-flags-header',
      'feature-flags-content'
    );

    const savedPayloads: Array<Record<string, string>> = [];
    await page.route('**/api/settings/save', async (route: Route) => {
      const body = route.request().postDataJSON() as Record<string, string>;
      if (body && typeof body === 'object') {
        const keys = Object.keys(body);
        if (keys.some((key) => FLAG_ENV_KEYS.has(key))) {
          savedPayloads.push(body);
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, restartRequired: false })
      });
    });

    await clickToggle(page, 'toggle-expertPipelineEnabled');
    await page.waitForTimeout(900);

    expect(savedPayloads.length).toBeGreaterThan(0);
    const firstPayload = savedPayloads[0];
    const payloadKey = Object.keys(firstPayload)[0];
    expect(FLAG_ENV_KEYS.has(payloadKey)).toBeTruthy();
    expect(['yes', 'no']).toContain(firstPayload[payloadKey]);
  });

  test('all feature flags are present and toggleable', async ({ page }) => {
    await openDeveloperSettings(page);
    await expandIfCollapsed(
      page,
      'feature-flags-header',
      'feature-flags-content'
    );

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
      const toggleId = `toggle-${flag}`;
      const toggle = page.locator(`[data-testid="${toggleId}"]`);
      await expect(toggle).toBeVisible();

      const wasChecked = await isToggleChecked(page, toggleId);
      await clickToggle(page, toggleId);
      await page.waitForTimeout(100);
      const nowChecked = await isToggleChecked(page, toggleId);
      expect(nowChecked).toBe(!wasChecked);
    }
  });

  test('environment variables section expands and collapses', async ({ page }) => {
    await openDeveloperSettings(page);

    const envContent = page.locator('[data-testid="env-vars-content"]');
    if (await envContent.isVisible()) {
      await page.click('[data-testid="env-vars-header"]');
      await expect(envContent).not.toBeVisible();
    }

    await page.click('[data-testid="env-vars-header"]');
    await expect(envContent).toBeVisible();
    await expect(page.locator('[data-testid="env-vars-indicator"]'))
      .toContainText('Manual save');

    await page.click('[data-testid="env-vars-header"]');
    await expect(envContent).not.toBeVisible();
  });

  test('environment variables section reflects moved settings IA', async ({
    page
  }) => {
    await openDeveloperSettings(page);
    await expandIfCollapsed(page, 'env-vars-header', 'env-vars-content');

    await page.fill('[data-testid="scan-interval-input"]', '*/15 * * * *');
    await expect(page.locator('[data-testid="scan-interval-input"]'))
      .toHaveValue('*/15 * * * *');

    await expect(page.locator('text=Service timeouts')).toBeVisible();
    await expect(page.locator('text=Token limits, text quality thresholds'))
      .toBeVisible();
  });

  test('manual save triggers restart-required event', async ({ page }) => {
    await openDeveloperSettings(page);
    await expandIfCollapsed(page, 'env-vars-header', 'env-vars-content');

    const events: string[] = [];
    await page.exposeFunction('logDevEvent', (eventName: string) => {
      events.push(eventName);
    });

    await page.evaluate(() => {
      document.addEventListener('settings:restart-required', () => {
        (
          window as unknown as {
            logDevEvent?: (_name: string) => void;
          }
        ).logDevEvent?.('settings:restart-required');
      });
      document.addEventListener('settings:saved', () => {
        (
          window as unknown as {
            logDevEvent?: (_name: string) => void;
          }
        ).logDevEvent?.('settings:saved');
      });
    });

    let saveBody: Record<string, unknown> | null = null;
    await page.route('**/api/settings/save', async (route: Route) => {
      saveBody = route.request().postDataJSON() as Record<string, string>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, restartRequired: true })
      });
    });

    await page.fill('[data-testid="scan-interval-input"]', '*/20 * * * *');
    await page.click('[data-testid="save-env-vars-button"]');
    await page.waitForTimeout(500);

    expect(saveBody).toBeTruthy();
    expect(saveBody?.SCAN_INTERVAL).toBe('*/20 * * * *');
    expect(events).toContain('settings:restart-required');
    expect(events).toContain('settings:saved');
    await expect(page.locator('[data-testid="save-message"]'))
      .toContainText('saved successfully');
  });

  test('save button shows loading state', async ({ page }) => {
    await openDeveloperSettings(page);
    await expandIfCollapsed(page, 'env-vars-header', 'env-vars-content');

    await page.route('**/api/settings/save', async (route: Route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, restartRequired: true })
      });
    });

    await page.fill('[data-testid="scan-interval-input"]', '*/25 * * * *');
    const saveButton = page.locator('[data-testid="save-env-vars-button"]');
    await saveButton.click();

    await expect(saveButton).toContainText('Saving...');
    await expect(saveButton).toBeDisabled();

    await page.waitForTimeout(600);
    await expect(saveButton).toHaveText('Save Environment Variables');
    await expect(saveButton).toBeDisabled();
  });

  test('section collapse state persists during interaction', async ({
    page
  }) => {
    await openDeveloperSettings(page);
    await expandIfCollapsed(
      page,
      'feature-flags-header',
      'feature-flags-content'
    );

    await clickToggle(page, 'toggle-visualRagEnabled');
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="feature-flags-content"]'))
      .toBeVisible();

    await expandIfCollapsed(page, 'env-vars-header', 'env-vars-content');
    await page.fill('[data-testid="scan-interval-input"]', '*/18 * * * *');

    await expect(page.locator('[data-testid="env-vars-content"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="feature-flags-content"]'))
      .toBeVisible();
  });

  test('warning banner displays correctly', async ({ page }) => {
    await openDeveloperSettings(page);

    const warning = page.locator('[data-testid="developer-warning"]');
    await expect(warning).toBeVisible();

    const backgroundColor = await warning.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    expect(backgroundColor).toBeTruthy();

    await expect(warning).toContainText('affect system behavior');
  });
});
