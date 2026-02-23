import { test, expect } from '@playwright/test';
const { getTestDocId } = require('../helpers/fixtures');
const { navigateToWorkspace } = require('../helpers/workspace-fixtures');

test.describe('Workspace - Smart Metadata Save', () => {
  test('smart metadata mounts and save triggers update API', async ({ page }) => {
    const docId = getTestDocId();

    await page.route('**/api/processing/update-document', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await navigateToWorkspace(page, docId);

    await page.waitForSelector('[data-testid="smart-metadata-root"]', { timeout: 15000 });
    const saveBtn = page.locator('[data-testid="save-all-btn"]').first();
    await expect(saveBtn).toBeVisible();

    await page.fill('[data-testid="smart-title-input"]', `Workspace Test ${Date.now()}`);

    const saveComplete = page.waitForResponse(resp =>
      resp.url().includes('/api/processing/update-document') &&
      resp.request().method() === 'POST'
    );

    await saveBtn.click();
    await saveComplete;

    const root = page.locator('[data-testid="document-context-bar-root"]');
    await expect(root).toHaveAttribute('data-status', 'saved');
  });

  test('context sidebar supports keyboard navigation', async ({ page }) => {
    const docId = getTestDocId();
    await navigateToWorkspace(page, docId);

    const tabMetadata = page.locator('[data-testid="tab-metadata"]');
    const tabContent = page.locator('[data-testid="tab-content"]');
    const tabChat = page.locator('[data-testid="tab-chat"]');

    await tabMetadata.click();
    await expect(tabMetadata).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    await expect(tabContent).toHaveAttribute('aria-selected', 'true');
    await expect(tabMetadata).toHaveAttribute('aria-selected', 'false');

    await page.keyboard.press('ArrowRight');
    await expect(tabChat).toHaveAttribute('aria-selected', 'true');
  });
});

