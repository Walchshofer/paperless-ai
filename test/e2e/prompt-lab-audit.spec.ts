import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');

const BASE =
  process.env.PLAYWRIGHT_BASE_URL
  || process.env.PAPERLESS_BASE_URL
  || 'http://localhost:3000';

type DomainKey = 'system' | 'medical' | 'financial' | 'legal';

const DOMAIN_KEYS: DomainKey[] = ['system', 'medical', 'financial', 'legal'];

async function openPromptsSettings(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/settings#prompts`, { waitUntil: 'domcontentloaded' });
  await waitForIsland(page, 'settings-sidebar-island', 10000);
  await waitForIsland(page, 'prompts-settings-island', 10000);
}

async function openFirstPromptInDomain(
  page: import('@playwright/test').Page,
  domain: DomainKey
) {
  const header = page.locator(`[data-testid="domain-header-${domain}"]`);
  if ((await header.count()) === 0) {
    return null;
  }

  await header.scrollIntoViewIfNeeded();
  const expanded = await header.getAttribute('aria-expanded');
  if (expanded === 'false') {
    await header.click();
    await page.waitForTimeout(150);
  }

  const rowButton = page
    .locator(`[data-testid="domain-group-${domain}"] [data-testid^="prompt-row-btn-"]`)
    .first();
  await expect(rowButton).toBeVisible({ timeout: 10000 });
  await rowButton.click();

  const editor = page.locator('[data-testid^="prompt-editor-"]').first();
  await expect(editor).toBeVisible({ timeout: 10000 });

  const editorId = await editor.getAttribute('data-testid');
  return { editor, editorId };
}

async function openPromptTestModal(
  page: import('@playwright/test').Page,
  editor: import('@playwright/test').Locator
) {
  const testButton = editor.locator('[data-testid^="prompt-test-"]').first();
  await expect(testButton).toBeVisible({ timeout: 10000 });
  await testButton.click();

  const modal = page.locator('[data-testid="prompt-test-modal"]');
  await expect(modal).toBeVisible({ timeout: 10000 });
  return modal;
}

async function stubPromptValidateEndpoint(page: import('@playwright/test').Page) {
  await page.route('**/api/prompts/*/test', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        jsonValid: true,
        duration: 42,
        tokenEstimate: 128,
        model: 'test-model',
        source: 'mock-validate',
        renderedSystemPrompt: 'SYSTEM_PROMPT_RENDERED',
        renderedTemplate: 'USER_TEMPLATE_RENDERED',
        testResult: {
          output: 'ok'
        }
      })
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__DISABLE_GITHUB_FETCH__ = true;
  });
});

test.describe('Prompt Lab Full Audit (Current Contracts)', () => {
  test('prompts settings island mounts and exposes domain groups', async ({ page }) => {
    await openPromptsSettings(page);

    const root = page.locator('[data-testid="prompts-settings-root"]');
    if ((await root.count()) === 0) {
      test.skip(true, 'Prompts section not available for current user');
      return;
    }

    await expect(root).toBeVisible();
    await expect(page.locator('[data-testid="domain-group-system"]')).toBeVisible();
  });

  test('domain prompts open editor panels with current IDs', async ({ page }) => {
    await openPromptsSettings(page);

    const root = page.locator('[data-testid="prompts-settings-root"]');
    if ((await root.count()) === 0) {
      test.skip(true, 'Prompts section not available for current user');
      return;
    }

    let openedCount = 0;
    for (const domain of DOMAIN_KEYS) {
      const opened = await openFirstPromptInDomain(page, domain);
      if (!opened) continue;

      openedCount += 1;
      expect(opened.editorId).toMatch(/^prompt-editor-/);
      await expect(opened.editor.locator('[data-testid^="prompt-save-"]')).toBeVisible();
      await expect(opened.editor.locator('[data-testid^="prompt-test-"]')).toBeVisible();
    }

    expect(openedCount).toBeGreaterThan(0);
  });

  test('prompt test lab executes validate mode and returns success badges', async ({ page }) => {
    await openPromptsSettings(page);

    const root = page.locator('[data-testid="prompts-settings-root"]');
    if ((await root.count()) === 0) {
      test.skip(true, 'Prompts section not available for current user');
      return;
    }

    await stubPromptValidateEndpoint(page);

    const opened =
      (await openFirstPromptInDomain(page, 'system'))
      || (await openFirstPromptInDomain(page, 'medical'))
      || (await openFirstPromptInDomain(page, 'financial'))
      || (await openFirstPromptInDomain(page, 'legal'));

    if (!opened) {
      test.skip(true, 'No prompt rows available to audit');
      return;
    }

    const modal = await openPromptTestModal(page, opened.editor);

    await modal.locator('[data-testid="test-source-mock"]').click();
    await expect(modal.locator('[data-testid="test-mode-validate"]')).toBeVisible();
    await modal.locator('[data-testid="test-mode-validate"]').click();
    await modal.locator('[data-testid="prompt-test-run"]').click();

    const results = modal.locator('[data-testid="prompt-test-results"]');
    await expect(results).toBeVisible({ timeout: 10000 });
    await expect(results.locator('span:has-text("Execution Successful")')).toBeVisible();
    await expect(results.locator('span:has-text("JSON Verified")')).toBeVisible();

    await modal.getByRole('button', { name: /Close Lab/i }).click();
    await expect(modal).toBeHidden();
  });

  test('document source mode loads document pickers and can run validate flow', async ({ page }) => {
    await openPromptsSettings(page);

    const root = page.locator('[data-testid="prompts-settings-root"]');
    if ((await root.count()) === 0) {
      test.skip(true, 'Prompts section not available for current user');
      return;
    }

    await page.route('**/api/documents/recent', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documents: [
            { id: 101, title: 'Doc A', created: '2026-02-01T00:00:00Z' }
          ]
        })
      });
    });
    await page.route('**/api/documents/*/content', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          document: {
            id: 101,
            title: 'Doc A',
            created: '2026-02-01T00:00:00Z',
            content: 'Sample OCR text content.'
          }
        })
      });
    });
    await page.route('**/api/documents/*/preview-image', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          image_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5nN6sAAAAASUVORK5CYII='
        })
      });
    });
    await stubPromptValidateEndpoint(page);

    const opened =
      (await openFirstPromptInDomain(page, 'system'))
      || (await openFirstPromptInDomain(page, 'medical'))
      || (await openFirstPromptInDomain(page, 'financial'))
      || (await openFirstPromptInDomain(page, 'legal'));

    if (!opened) {
      test.skip(true, 'No prompt rows available to audit');
      return;
    }

    const modal = await openPromptTestModal(page, opened.editor);
    await modal.locator('[data-testid="test-source-document"]').click();
    const docButton = modal.locator('[data-testid^="test-subject-doc-"]').first();
    await expect(docButton).toBeVisible({ timeout: 10000 });
    await docButton.click();

    await modal.locator('[data-testid="test-mode-validate"]').click();
    await modal.locator('[data-testid="prompt-test-run"]').click();

    const results = modal.locator('[data-testid="prompt-test-results"]');
    await expect(results).toBeVisible({ timeout: 10000 });
    await expect(results.locator('span:has-text("Execution Successful")')).toBeVisible();
  });
});
