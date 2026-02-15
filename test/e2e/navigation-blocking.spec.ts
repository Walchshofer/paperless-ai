import { test, expect } from '@playwright/test';
const fixtures = require('../helpers/fixtures');

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test('navigation is blocked when workspace is dirty (confirm modal)', async ({ page }) => {
  const docId = fixtures.getHistoryDocId();
  await page.goto(`${BASE}/document/${docId}`, { waitUntil: 'domcontentloaded' });

  // Ensure island mounted
  const { waitForIsland } = require('../helpers/island-waits');
  await waitForIsland(page, 'document-context-bar-island', 10000);

  // Mark current document as dirty via page script
  await page.evaluate((d) => {
    const w = window as unknown as { __workspaceState?: Record<string, { isDirty?: boolean }> };
    w.__workspaceState = w.__workspaceState || {};
    w.__workspaceState[String(d)] = { isDirty: true };
  }, docId);

  const nextBtn = page.locator('[data-testid="nav-next-btn"]');
  if (await nextBtn.count() > 0) {
    // Click Next to open modal
    await nextBtn.click();

    const modal = page.locator('[data-testid="nav-confirm-modal"]');
    await expect(modal).toBeVisible();

    // Click Cancel and ensure we stay on the same page
    await page.click('[data-testid="nav-confirm-cancel"]');
    await page.waitForTimeout(200);
    expect(page.url()).toContain(`/document/${docId}`);

    // Open modal again and click Discard (navigate)
    await nextBtn.click();
    await expect(modal).toBeVisible();
    await page.click('[data-testid="nav-confirm-discard"]');
    // wait for navigation
    await page.waitForTimeout(500);
    expect(page.url()).not.toContain(`/document/${docId}`);

    // NAV BACK to test Save flow (go back to same document)
    await page.goBack();
    await page.waitForTimeout(200);
    // Mark dirty via a real SmartMetadata edit so participant will respond to coordinator
    await page.fill('[data-testid="smart-title-input"]', 'Edited Title');

    // Click Next, then click Save and ensure navigation happens after coordinator completes
    await nextBtn.click();
    await expect(modal).toBeVisible();
    await page.click('[data-testid="nav-confirm-save"]');

    // Wait for coordinator-driven navigation (up to 5s)
    await page.waitForURL((url: URL) => !url.toString().includes(`/document/${docId}`), { timeout: 5000 });
    expect(page.url()).not.toContain(`/document/${docId}`);
  } else {
    test.skip(true, 'Next button not present for test document');
  }
});
