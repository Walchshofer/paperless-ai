import { test, expect } from '@playwright/test';

// Basic skeleton for the feedback E2E test. Flesh out selectors and mocks as needed.

test.describe('Feedback Flow E2E', () => {
  test('user edits and submits feedback, backend persists event', async ({ page, request }) => {
    const docId = process.env.TEST_DOC_ID || '123';
    // Navigate to manual editor page
    await page.goto(`http://localhost:3000/manual/${docId}`);

    // Check island anchor exists
    const island = page.locator('[data-island]');
    await expect(island).toHaveCountGreaterThan(0);

    // TODO: simulate edit and submit via UI controls
    // await page.fill('[data-testid="manual-total-amount-input"]', '105.00');
    // await page.click('[data-testid="manual-submit-btn"]');

    // TODO: intercept /manual/updateDocument and assert payload
    // const [response] = await Promise.all([
    //   page.waitForResponse(resp => resp.url().includes('/manual/updateDocument') && resp.status() === 200),
    //   page.click('[data-testid="manual-submit-btn"]')
    // ]);

    // Expect success toast
    // await expect(page.locator('.toast-success')).toBeVisible();
  });
});