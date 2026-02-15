import { test, expect } from '@playwright/test';
const { waitForIsland } = require('../helpers/island-waits');
const fixtures = require('../helpers/fixtures');

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

test.describe('SmartMetadata Field Mapping E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__DISABLE_GITHUB_FETCH__ = true;
      try { localStorage.removeItem('paperless:context-sidebar.activeTab'); } catch (e) {}
    });
  });

  test('domain badge and mapping affordances render', async ({ page }) => {
    const docId = fixtures.getTestDocId();
    await page.goto(`${BASE}/workspace/doc/${docId}?tab=metadata`, {
      waitUntil: 'domcontentloaded'
    });
    await waitForIsland(page, 'context-sidebar-island', 10000);
    await expect(page.locator('[data-testid="smart-metadata-root"]'))
      .toBeVisible();

    const badge = page.locator('[data-testid="document-domain-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/Document/i);

    const mappingBadges = page.locator('[data-testid^="mapping-badge-"]');
    const mappingCount = await mappingBadges.count();
    if (mappingCount > 0) {
      await expect(mappingBadges.first()).toBeVisible();
    } else {
      await expect(page.locator('[data-testid="no-required-fields"]'))
        .toBeVisible();
      await expect(page.locator('[data-testid="no-optional-fields"]'))
        .toBeVisible();
      await expect(page.locator('[data-testid="no-visual-fields"]'))
        .toBeVisible();
    }
  });

  test('locate buttons dispatch metadata:locate-field', async ({ page }, testInfo) => {
    const docId = fixtures.getTestDocId();
    await page.goto(`${BASE}/workspace/doc/${docId}?tab=metadata`, {
      waitUntil: 'domcontentloaded'
    });
    await waitForIsland(page, 'context-sidebar-island', 10000);
    await expect(page.locator('[data-testid="smart-metadata-root"]'))
      .toBeVisible();

    const locateButtons = page.locator(
      '[data-testid^="locate-required-"], [data-testid^="locate-optional-"], [data-testid^="locate-visual-"]'
    );
    const locateCount = await locateButtons.count();
    if (locateCount === 0) {
      testInfo.annotations.push({
        type: 'note',
        description: 'No locate controls available in current fixture; skipping dispatch assertion.'
      });
      return;
    }

    const locateButton = locateButtons.first();
    await expect(locateButton).toBeVisible();

    await locateButton.click();
    await page.waitForTimeout(200);

    const locateState = await page.evaluate(() => {
      const w = window as unknown as { __last_metadata_locate?: { fieldId?: string } };
      return w.__last_metadata_locate || null;
    });

    expect(locateState).toBeTruthy();
    expect(locateState.fieldId).toBeTruthy();
  });

  test('validation banner appears when required field cleared', async ({ page }, testInfo) => {
    const docId = fixtures.getTestDocId();
    await page.goto(`${BASE}/workspace/doc/${docId}?tab=metadata`, {
      waitUntil: 'domcontentloaded'
    });
    await waitForIsland(page, 'context-sidebar-island', 10000);
    await expect(page.locator('[data-testid="smart-metadata-root"]'))
      .toBeVisible();

    const requiredInputs = page.locator('[data-testid^="required-field-value-"]');
    const count = await requiredInputs.count();
    if (count === 0) {
      testInfo.annotations.push({ type: 'note', description: 'No required fields present in fixture; skipping validation assertion.' });
      return;
    }

    const input = requiredInputs.first();
    await input.fill('');
    await input.dispatchEvent('input');

    const banner = page.locator('[data-testid="validation-error"]');
    await expect(banner).toBeVisible();
  });
});
