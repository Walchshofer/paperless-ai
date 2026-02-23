import { test, expect, type Route } from '@playwright/test';

const {
  navigateToHistoryDoc
} = require('../helpers/workspace-fixtures');
const { getHistoryDocId, getTestDocId } = require('../helpers/fixtures');
const {
  pollForFeedbackEvent,
  cleanupTestData,
  isPostgresAvailable
} = require('../helpers/db-poll');

test.describe('Feedback comprehensive flow', () => {
  test('feedback button opens modal and renders form', async ({ page }) => {
    const docId = getHistoryDocId();
    await navigateToHistoryDoc(page, docId);

    await page.click('[data-testid="history-feedback-button"]');
    await expect(page.locator('#feedback-modal')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-star-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-correction-vendor"]')).toBeVisible();
    await expect(page.locator('#feedback-comments')).toBeVisible();
  });

  test('submitting feedback shows success and records corrections', async ({ page }) => {
    const docId = getHistoryDocId();
    await navigateToHistoryDoc(page, docId);

    try {
      const capturedRef: { value: { documentId?: unknown; corrections?: unknown } | null } = { value: null };
      await page.route('**/api/feedback', async (route: Route) => {
        capturedRef.value = route.request().postDataJSON() as { documentId?: unknown; corrections?: unknown };
        await route.continue();
      });

      await page.click('[data-testid="history-feedback-button"]');
      await page.click('[data-testid="feedback-star-4"]');
      await page.click('[data-testid="feedback-correction-vendor"]');
      await page.fill('#feedback-comments', 'E2E feedback: vendor correction');

      await page.click('[data-testid="feedback-submit-btn"]');

      await expect(page.locator('#feedback-success')).toBeVisible({ timeout: 15000 });

      const captured = capturedRef.value;
      expect(captured).toBeTruthy();
      if (captured) {
        expect(captured.documentId).toBe(String(docId));
        expect(captured.corrections).toContain('vendor');
      }

      const analytics = await page.request.get('/api/feedback/analytics');
      if (analytics.status() === 200) {
        const data = await analytics.json();
        expect(data.success).toBeTruthy();
        expect(data.analytics).toBeTruthy();
      }
    } finally {
      await cleanupTestData(docId);
    }
  });

  test('feedback modal closes after submission', async ({ page }) => {
    const docId = getHistoryDocId();
    await navigateToHistoryDoc(page, docId);

    try {
      await page.click('[data-testid="history-feedback-button"]');
      await page.click('[data-testid="feedback-star-5"]');
      await page.fill('#feedback-comments', 'E2E feedback close modal');

      await page.click('[data-testid="feedback-submit-btn"]');
      await expect(page.locator('#feedback-success')).toBeVisible({ timeout: 15000 });

      await page.click('[data-testid="feedback-close-success-btn"]');
      await expect(page.locator('#feedback-modal')).toBeHidden({ timeout: 10000 });
    } finally {
      await cleanupTestData(docId);
    }
  });

  test('request id tracking propagates on feedback events', async ({ page }) => {
    const pgAvailable = await isPostgresAvailable(1500);
    if (!pgAvailable) {
      test.skip(true, 'Postgres not available - skipping DB dependent test');
      return;
    }

    const docId = getTestDocId();
    const requestId = `e2e-feedback-${Date.now()}`;

    const payload = {
      documentId: docId,
      document_updates: { title: `E2E Feedback ${Date.now()}` },
      feedback_events: [
        {
          event_type: 'correction',
          field_name: 'title',
          corrected_value: { title: 'Updated' },
          context: { note: 'E2E feedback flow' }
        }
      ]
    };

    try {
      const resp = await page.request.post('/api/processing/update-document', {
        headers: { 'X-Request-Id': requestId },
        data: payload
      });

      expect(resp.status(), 'update-document should succeed').toBeLessThan(400);

      const row = await pollForFeedbackEvent(docId, 'correction', 8000);
      expect(row).toBeTruthy();
      if (row) {
        const context = row.context || {};
        expect(context.request_id || context.requestId).toBe(requestId);
      }
    } finally {
      await cleanupTestData(docId);
    }
  });
});
