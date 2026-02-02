import { test, expect } from '@playwright/test';
import { pollForFeedbackEvent, queryDb, isPostgresAvailable } from '../helpers/db-poll';
import { getTestDocId } from '../helpers/fixtures';

// E2E: Verify feedback persistence, fields, and request-id tracing
test.describe('Feedback Flow E2E', () => {
  test('feedback events persist to Postgres with correct fields and request id tracking', async ({ page }) => {
    // Skip this test early if Postgres is not reachable in the test environment
    const pgAvailable = await isPostgresAvailable(1500);
    if (!pgAvailable) {
      test.skip(true, 'Postgres not available - skipping DB dependent E2E test');
      return;
    }
    const docId = getTestDocId();

    // Deterministic request id for tracing
    const requestId = `e2e-${Date.now()}`;

    // Correction details
    const correctedCorrespondent = { id: 9999, name: 'E2E Correspondent' };
    const events = [
      {
        event_type: 'correction',
        field_name: 'correspondent',
        corrected_value: correctedCorrespondent,
        context: { note: 'E2E test correction' }
      }
    ];

    const beforeTs = Date.now();

    // POST to orchestrator endpoint (this simulates the UI flow and propagates X-Request-Id)
    const resp = await page.request.post(`http://localhost:3000/manual/updateDocument`, {
      headers: { 'X-Request-Id': requestId },
      data: {
        documentId: docId,
        document_updates: { correspondent: correctedCorrespondent },
        feedback_events: events
      }
    });

    expect(resp.status(), 'manual/updateDocument should succeed').toBeLessThan(400);

    // Poll Postgres for the feedback row (max 5s)
    const row = await pollForFeedbackEvent(docId, 'correction', 5000) as Record<string, unknown> | null;

    // Field assertions
    expect(row).toBeTruthy();
    if (!row) return; // TypeScript narrowing
    expect(row.doc_id).toBe(docId);
    expect(row.event_type).toBe('correction');

    // corrected_value JSONB must contain the correspondent name
    const corrected = row.corrected_value as Record<string, unknown> | string;
    expect(corrected).toBeTruthy();
    const corrName = typeof corrected === 'string' ? JSON.parse(corrected).name : (corrected as Record<string, unknown>).name;
    expect(corrName).toBe(correctedCorrespondent.name);

    // request_id should be present in context and match the header we set
    const context = (row.context || {}) as Record<string, unknown>;
    expect(context.request_id || context.requestId).toBe(requestId);

    // created_at within the test window (allow small skew)
    const createdAt = new Date(row.created_at as string).getTime();
    expect(createdAt).toBeGreaterThanOrEqual(beforeTs - 1000);
    expect(createdAt).toBeLessThanOrEqual(Date.now() + 1000);

    // Cleanup (remove test rows)
    await queryDb('DELETE FROM feedback_events WHERE doc_id = $1', [docId]);
  });
});
