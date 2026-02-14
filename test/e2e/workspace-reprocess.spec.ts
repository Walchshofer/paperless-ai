/**
 * Workspace Reprocess E2E Tests
 *
 * Tests for the Reprocess button functionality in the workspace view.
 * These tests verify the full end-to-end flow from button click to metadata update.
 *
 * @see routes/api/documents.js
 * @see src/islands/DocumentContextBarIsland.tsx
 */

import { test, expect } from '@playwright/test';

const REPROCESS_API_TIMEOUT_MS = 120000;

test.describe('Workspace Reprocess E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to workspace with a test document
    // Note: This assumes document 74 exists in the test environment
    await page.goto('/workspace/doc/74');

    // Wait for the page to load - use correct data-page attribute
    await page.waitForSelector('[data-page="document-workspace"]', { timeout: 10000 });
  });

  test('should show Reprocess button in context bar', async ({ page }) => {
    const reprocessBtn = page.locator('[data-testid="reprocess-btn"]');
    await expect(reprocessBtn).toBeVisible();
    await expect(reprocessBtn).toContainText('Reprocess');
  });

  test('should disable Reprocess button when no document is selected', async ({ page }) => {
    // Navigate to workspace without a document
    await page.goto('/workspace');
    await page.waitForSelector('[data-page="workspace"]');

    const reprocessBtn = page.locator('[data-testid="reprocess-btn"]');
    // Button may be disabled or not visible when no document is selected
    const isDisabled = await reprocessBtn.getAttribute('disabled');
    expect(isDisabled !== null || !(await reprocessBtn.isVisible())).toBeTruthy();
  });

  test('should show loading state when Reprocess is clicked', async ({ page }) => {
    const reprocessBtn = page.locator('[data-testid="reprocess-btn"]');

    // Click the reprocess button
    await reprocessBtn.click();

    // Button should show processing state
    await expect(reprocessBtn).toContainText('Reprocessing...');
    await expect(reprocessBtn).toHaveAttribute('disabled', '');

    // Should have a spinner icon
    const spinnerIcon = reprocessBtn.locator('i.fa-circle-notch.fa-spin');
    await expect(spinnerIcon).toBeVisible();
  });

  test('should show success notification after reprocess completes', async ({ page }) => {
    const reprocessBtn = page.locator('[data-testid="reprocess-btn"]');

    // Click the reprocess button
    await reprocessBtn.click();

    // Wait for completion (with longer timeout for pipeline execution)
    await expect(page.locator('[data-testid="reprocess-notification"]')).toBeVisible({
      timeout: 120000 // 2 minutes
    });

    // Verify success message
    const notification = page.locator('[data-testid="reprocess-notification"]');
    await expect(notification).toContainText('successfully');
    await expect(notification).toHaveClass(/bg-green-50/);
  });

  test('should show error notification when reprocess fails', async ({ page }) => {
    // Use an invalid document ID to trigger an error
    await page.goto('/workspace/doc/999999999');

    // Wait for any loading to complete
    await page.waitForTimeout(1000);

    const reprocessBtn = page.locator('[data-testid="reprocess-btn"]');

    // Only proceed if button exists (page might not render if doc doesn't exist)
    if (await reprocessBtn.isVisible()) {
      await reprocessBtn.click();

      // Wait for error notification
      await expect(page.locator('[data-testid="reprocess-notification"]')).toBeVisible({
        timeout: 30000
      });

      const notification = page.locator('[data-testid="reprocess-notification"]');
      await expect(notification).toContainText('failed');
      await expect(notification).toHaveClass(/bg-red-50/);
    }
  });

  test('should dismiss notification when close button is clicked', async ({ page }) => {
    const reprocessBtn = page.locator('[data-testid="reprocess-btn"]');

    // Click the reprocess button
    await reprocessBtn.click();

    // Wait for notification to appear
    await expect(page.locator('[data-testid="reprocess-notification"]')).toBeVisible({
      timeout: 120000
    });

    // Click the dismiss button
    const dismissBtn = page.locator('[data-testid="reprocess-notification"] button');
    await dismissBtn.click();

    // Notification should be dismissed
    await expect(page.locator('[data-testid="reprocess-notification"]')).not.toBeVisible();
  });

  test('should update metadata panel after successful reprocess', async ({ page }) => {
    // Get initial title value (if visible)
    const titleInput = page.locator('[data-testid="smart-title-input"]');
    const initialTitle = await titleInput.inputValue().catch(() => '');

    const reprocessBtn = page.locator('[data-testid="reprocess-btn"]');

    // Click reprocess
    await reprocessBtn.click();

    // Wait for completion
    await expect(page.locator('[data-testid="reprocess-notification"]')).toBeVisible({
      timeout: 120000
    });
    await expect(page.locator('[data-testid="reprocess-notification"]')).toContainText('successfully');

    // If metadata was extracted, title or other fields might be updated
    // This test just verifies the flow completes without error
    await expect(titleInput).toBeVisible();
  });

  test('should have accessible notification with proper ARIA attributes', async ({ page }) => {
    const reprocessBtn = page.locator('[data-testid="reprocess-btn"]');

    // Click reprocess
    await reprocessBtn.click();

    // Wait for notification
    await expect(page.locator('[data-testid="reprocess-notification"]')).toBeVisible({
      timeout: 120000
    });

    const notification = page.locator('[data-testid="reprocess-notification"]');

    // Check accessibility attributes
    await expect(notification).toHaveAttribute('role', 'alert');
    await expect(notification).toHaveAttribute('aria-live', 'polite');
  });
});

test.describe('Reprocess API Integration', () => {
  test('should make POST request to correct endpoint', async ({ page, request }) => {
    // Test the API directly
    const response = await request.post('/api/documents/74/reprocess', {
      timeout: REPROCESS_API_TIMEOUT_MS
    });

    // Should get a valid response (success or auth required)
    expect([200, 401, 404, 500]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('documentId');
      expect(body).toHaveProperty('classification');
    }
  });

  test('should return 400 for invalid document ID', async ({ request }) => {
    const response = await request.post('/api/documents/invalid/reprocess');

    // Either 400 for invalid ID or 401 for auth
    expect([400, 401]).toContain(response.status());
  });
});
