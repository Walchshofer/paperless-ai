import { test, expect } from '@playwright/test';

const {
  navigateToWorkspace,
  waitForIslandMount
} = require('../helpers/workspace-fixtures');

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Document Selection in Workspace', () => {
  test(
    'Document selection navigates to /workspace/doc/{id} not /document/{id}',
    async ({ page }) => {
      // /workspace intentionally renders an empty-state shell (no auto-selected doc).
      // networkidle is fragile here due to long-lived connections; wait for DOM + page id.
      await page.goto(`${BASE}/workspace`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-page="workspace"]', {
        timeout: 20000
      });
      await waitForIslandMount(page, 'document-context-bar-island');

      const selectorTrigger = page.locator(
        '[data-testid="document-selector-trigger"]'
      );
      await expect(selectorTrigger).toBeVisible();

      const selectorDropdown = page.locator(
        '[data-testid="document-selector-dropdown"]'
      );
      if (await selectorDropdown.count() === 0) {
        await selectorTrigger.click();
        await expect(selectorDropdown).toBeVisible();
      }

      const docOptions = page.locator('[data-testid^="document-option-"]');
      const optionCount = await docOptions.count();
      if (optionCount === 0) {
        test.skip(true, 'No document options available to select');
        return;
      }

      const currentMatch = page.url().match(/\/workspace\/doc\/(\d+)/);
      const currentId = currentMatch ? Number(currentMatch[1]) : null;

      let targetOption = docOptions.first();
      let targetId = null as number | null;

      for (let i = 0; i < optionCount; i += 1) {
        const option = docOptions.nth(i);
        const testId = await option.getAttribute('data-testid');
        const match = testId ? testId.match(/document-option-(\d+)/) : null;
        const id = match ? Number(match[1]) : null;
        if (id && (currentId == null || id !== currentId)) {
          targetOption = option;
          targetId = id;
          break;
        }
      }

      if (targetId == null) {
        const fallbackTestId = await targetOption.getAttribute('data-testid');
        const fallbackMatch = fallbackTestId
          ? fallbackTestId.match(/document-option-(\d+)/)
          : null;
        targetId = fallbackMatch ? Number(fallbackMatch[1]) : null;
      }

      if (targetId == null) {
        test.skip(true, 'Unable to identify target document option');
        return;
      }

      await targetOption.scrollIntoViewIfNeeded();
      await Promise.all([
        page.waitForURL(new RegExp(`/workspace/doc/${targetId}`), {
          timeout: 20000
        }),
        targetOption.click()
      ]);

      // Inline navigation updates URL via pushState; page id stays `workspace`.
      // Wait for the selector trigger to reflect the selected doc title.
      await expect(selectorTrigger).not.toContainText('Select Document', {
        timeout: 20000
      });

      const finalUrl = page.url();
      expect(finalUrl).toContain(`/workspace/doc/${targetId}`);
      expect(finalUrl).not.toContain('/document/');
      await expect(
        page.locator('[data-testid="document-context-bar-root"]')
      ).toBeVisible();
    }
  );

  test('Verify /workspace/doc/{id} loads document correctly', async ({ page }) => {
    const docId = await navigateToWorkspace(page);
    await waitForIslandMount(page, 'document-context-bar-island');

    await expect(page).toHaveURL(new RegExp(`/workspace/doc/${docId}`), {
      timeout: 20000
    });

    const errorEl = page.locator(
      'h1:has-text("Error"), h1:has-text("404"), .error-message'
    );
    await expect(errorEl).toHaveCount(0);

    await expect(
      page.locator('[data-testid="document-context-bar-root"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="context-sidebar-root"], [data-testid="context-sidebar"]').first()
    ).toBeVisible();
  });
});
