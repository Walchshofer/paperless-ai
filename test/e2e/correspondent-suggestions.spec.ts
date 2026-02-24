import { test, expect, type Route } from '@playwright/test';
const fixtures = require('../helpers/fixtures');
const { navigateToWorkspace, waitForIslandMount } = require('../helpers/workspace-fixtures');

const _BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.PAPERLESS_BASE_URL || 'http://localhost:3000';

// Mock API response for correspondent suggestions
const MOCK_CORRESPONDENTS_RESPONSE = {
  success: true,
  correspondents: [
    { id: 1, name: 'Mustermann GmbH' },
    { id: 2, name: 'Example AG' },
    { id: 3, name: 'Test KG' }
  ]
};

test.describe('Correspondent suggestion wand (T2c)', () => {
  let docId: number;

  test.beforeEach(async ({ page }) => {
    docId = fixtures.getTestDocId();
    // Intercept the correspondents API call to return predictable suggestions
    await page.route('**/api/documents/correspondents', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CORRESPONDENTS_RESPONSE)
      });
    });
    await navigateToWorkspace(page, docId);
    await waitForIslandMount(page, 'context-sidebar-island', 15000);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  test('wand button is visible next to correspondent input', async ({ page }) => {
    // Arrange: workspace loaded in beforeEach
    // Act: locate the wand button
    const wandBtn = page.locator('[data-testid="suggest-correspondent-btn"]');
    // Assert
    await expect(wandBtn).toBeVisible({ timeout: 10000 });
  });

  test('clicking wand populates suggestion chips from API', async ({ page }) => {
    // Arrange
    const wandBtn = page.locator('[data-testid="suggest-correspondent-btn"]');
    await expect(wandBtn).toBeVisible({ timeout: 10000 });
    // Act
    await wandBtn.click();
    // Assert: suggestion chip container appears with at least one chip
    await expect(page.locator('[data-testid="correspondent-suggestions"]')).toBeVisible({ timeout: 10000 });
    const chipCount = await page.locator('[data-testid="correspondent-suggestions"] button').count();
    expect(chipCount).toBeGreaterThan(0);
  });

  test('clicking a suggestion chip updates the correspondent input and clears chips', async ({ page }) => {
    // Arrange
    const wandBtn = page.locator('[data-testid="suggest-correspondent-btn"]');
    await expect(wandBtn).toBeVisible({ timeout: 10000 });
    await wandBtn.click();
    await expect(page.locator('[data-testid="correspondent-suggestions"]')).toBeVisible({ timeout: 10000 });
    // Act: click the first suggestion chip (not the Dismiss button which is last)
    const chips = page.locator('[data-testid="correspondent-suggestions"] button');
    const chipCount = await chips.count();
    // The Dismiss button is the last one — click any non-dismiss chip
    expect(chipCount).toBeGreaterThan(1);
    const firstChip = chips.first();
    const chipText = (await firstChip.textContent())?.trim() ?? '';
    await firstChip.click();
    // Assert: chip container disappears after selection
    await expect(page.locator('[data-testid="correspondent-suggestions"]')).not.toBeVisible({ timeout: 3000 });
    // Assert: correspondent input now contains the chip's text
    const correspondentInput = page.locator('[data-testid="smart-correspondent-input"]');
    await expect(correspondentInput).toHaveValue(chipText, { timeout: 3000 });
  });

  test('Dismiss button clears chips without updating the correspondent input', async ({ page }) => {
    // Arrange
    const originalValue = await page.locator('[data-testid="smart-correspondent-input"]').inputValue();
    const wandBtn = page.locator('[data-testid="suggest-correspondent-btn"]');
    await expect(wandBtn).toBeVisible({ timeout: 10000 });
    await wandBtn.click();
    await expect(page.locator('[data-testid="correspondent-suggestions"]')).toBeVisible({ timeout: 10000 });
    // Act: the Dismiss button is the last child of the suggestions container
    const dismissBtn = page.locator('[data-testid="correspondent-suggestions"] button:last-child');
    await dismissBtn.click();
    // Assert: chips are gone
    await expect(page.locator('[data-testid="correspondent-suggestions"]')).not.toBeVisible({ timeout: 3000 });
    // Assert: input value is unchanged
    const newValue = await page.locator('[data-testid="smart-correspondent-input"]').inputValue();
    expect(newValue).toBe(originalValue);
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────

  test('wand button is disabled while the fetch is in progress', async ({ page }) => {
    // Arrange: use a slow route to ensure we can capture the disabled state
    await page.route('**/api/documents/correspondents', async (route: Route) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CORRESPONDENTS_RESPONSE)
      });
    });
    const wandBtn = page.locator('[data-testid="suggest-correspondent-btn"]');
    await expect(wandBtn).toBeVisible({ timeout: 10000 });
    // Act
    await wandBtn.click();
    // Assert: button becomes disabled immediately after click
    await expect(wandBtn).toBeDisabled({ timeout: 2000 });
    // Wait for fetch to complete and button to re-enable
    await expect(wandBtn).not.toBeDisabled({ timeout: 5000 });
  });

  test('wand does not populate chips when API returns empty list', async ({ page }) => {
    // Arrange: override route to return no correspondents
    await page.route('**/api/documents/correspondents', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, correspondents: [] })
      });
    });
    const wandBtn = page.locator('[data-testid="suggest-correspondent-btn"]');
    await expect(wandBtn).toBeVisible({ timeout: 10000 });
    // Act
    await wandBtn.click();
    // Wait for fetch to complete (button re-enables)
    await expect(wandBtn).not.toBeDisabled({ timeout: 5000 });
    // Assert: suggestions container does not appear (no names to suggest)
    const suggestionsVisible = await page.locator('[data-testid="correspondent-suggestions"]').isVisible().catch(() => false);
    expect(suggestionsVisible).toBe(false);
  });

  test('wand shows error-tolerant fallback when API call fails', async ({ page }) => {
    // Arrange: override route to return a 500
    await page.route('**/api/documents/correspondents', async (route: Route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });
    const wandBtn = page.locator('[data-testid="suggest-correspondent-btn"]');
    await expect(wandBtn).toBeVisible({ timeout: 10000 });
    // Act
    await wandBtn.click();
    // Assert: button recovers (no longer disabled) — no crash or hang
    await expect(wandBtn).not.toBeDisabled({ timeout: 8000 });
    // Assert: no suggestion chips rendered
    const suggestionsVisible = await page.locator('[data-testid="correspondent-suggestions"]').isVisible().catch(() => false);
    expect(suggestionsVisible).toBe(false);
  });
});
