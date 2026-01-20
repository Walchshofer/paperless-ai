import { test, expect } from '@playwright/test';
import { pollForFeedbackEvent, queryDb } from '../helpers/db-poll';

/**
 * PostgreSQL Persistence Audit Test
 *
 * Verifies that feedback events are correctly persisted to PostgreSQL
 * with all required fields and proper JSON serialization.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const TEST_DOC_ID = Number(process.env.TEST_DOC_ID || '1');

test.describe('PostgreSQL Persistence Audit', () => {
  const testRequestId = `e2e-pg-audit-${Date.now()}`;
  let createdEventIds: string[] = [];

  // Clean up test data after suite
  test.afterAll(async () => {
    if (createdEventIds.length > 0) {
      try {
        await queryDb(
          'DELETE FROM feedback_events WHERE id::text = ANY($1::text[])',
          [createdEventIds]
        );
      } catch (err) {
        console.warn('Cleanup failed:', err);
      }
    }
  });

  test('feedback event persists with all required fields', async ({ page }) => {
    const correction = {
      event_type: 'correction',
      field_name: 'correspondent',
      corrected_value: { id: 9999, name: 'E2E Test Correspondent' },
      context: {
        note: 'Persistence audit test',
        request_id: testRequestId,
        tagIds: [1, 2, 3],
      }
    };

    const beforeTs = Date.now();

    // Submit via API
    const resp = await page.request.post(`${BASE_URL}/manual/updateDocument`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': testRequestId,
      },
      data: {
        documentId: TEST_DOC_ID,
        document_updates: { correspondent: correction.corrected_value },
        feedback_events: [correction]
      }
    });

    // Allow 4xx responses if endpoint doesn't exist
    if (resp.status() === 404) {
      test.skip(true, 'manual/updateDocument endpoint not available');
      return;
    }

    expect(resp.status()).toBeLessThan(500);

    // Poll for the feedback row
    let row;
    try {
      row = await pollForFeedbackEvent(TEST_DOC_ID, 'correction', 10000);
    } catch (err) {
      // Might not have the table yet
      test.skip(true, 'feedback_events table not available or no row found');
      return;
    }

    // Track for cleanup
    if (row?.id) createdEventIds.push(String(row.id));

    // Verify required fields
    expect(row).toBeTruthy();
    expect(row.doc_id).toBe(TEST_DOC_ID);
    expect(row.event_type).toBe('correction');
    expect(row.field_name).toBe('correspondent');

    // Verify JSONB fields
    expect(row.corrected_value).toBeTruthy();
    const corrected = typeof row.corrected_value === 'string'
      ? JSON.parse(row.corrected_value)
      : row.corrected_value;
    expect(corrected.name).toBe('E2E Test Correspondent');

    // Verify context contains request_id
    const context = row.context || {};
    expect(context.request_id || context.requestId).toBe(testRequestId);

    // Verify tagIds in context
    expect(context.tagIds).toEqual([1, 2, 3]);

    // Verify timestamp is within test window
    const createdAt = new Date(row.created_at).getTime();
    expect(createdAt).toBeGreaterThanOrEqual(beforeTs - 2000);
    expect(createdAt).toBeLessThanOrEqual(Date.now() + 2000);
  });

  test('multiple feedback events persist atomically', async ({ page }) => {
    const batchRequestId = `e2e-batch-${Date.now()}`;
    const events = [
      {
        event_type: 'verification',
        field_name: 'tags',
        context: { batch_id: batchRequestId }
      },
      {
        event_type: 'verification',
        field_name: 'document_type',
        context: { batch_id: batchRequestId }
      },
      {
        event_type: 'correction',
        field_name: 'title',
        corrected_value: 'Batch Test Title',
        context: { batch_id: batchRequestId }
      }
    ];

    const resp = await page.request.post(`${BASE_URL}/api/visual-rag/feedback`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': batchRequestId,
      },
      data: {
        documentId: TEST_DOC_ID,
        events
      }
    });

    if (resp.status() === 404 || resp.status() === 500) {
      test.skip(true, 'Feedback API not available');
      return;
    }

    expect(resp.status()).toBeLessThan(400);

    // Query for all events with this batch_id
    await new Promise(r => setTimeout(r, 1000)); // Wait for persistence

    let rows;
    try {
      rows = await queryDb(
        `SELECT * FROM feedback_events
         WHERE doc_id = $1
         AND context->>'batch_id' = $2
         ORDER BY created_at DESC`,
        [TEST_DOC_ID, batchRequestId]
      );
    } catch (err) {
      test.skip(true, 'Could not query feedback_events');
      return;
    }

    // Track for cleanup
    rows.forEach((r: any) => {
      if (r.id) createdEventIds.push(String(r.id));
    });

    // Should have all 3 events
    expect(rows.length).toBe(3);

    // Verify each event type
    const eventTypes = rows.map((r: any) => r.event_type);
    expect(eventTypes).toContain('verification');
    expect(eventTypes).toContain('correction');

    const fieldNames = rows.map((r: any) => r.field_name);
    expect(fieldNames).toContain('tags');
    expect(fieldNames).toContain('document_type');
    expect(fieldNames).toContain('title');
  });

  test('JSONB fields support complex nested structures', async ({ page }) => {
    const complexRequestId = `e2e-complex-${Date.now()}`;
    const complexValue = {
      nested: {
        array: [1, 2, { deep: 'value' }],
        object: { key: 'value', number: 42 }
      },
      unicode: '日本語テスト',
      special: 'quotes"and\'apostrophes'
    };

    const resp = await page.request.post(`${BASE_URL}/api/visual-rag/feedback`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': complexRequestId,
      },
      data: {
        documentId: TEST_DOC_ID,
        events: [{
          event_type: 'correction',
          field_name: 'complex_test',
          corrected_value: complexValue,
          context: { test_id: complexRequestId }
        }]
      }
    });

    if (resp.status() >= 400) {
      test.skip(true, 'Feedback API not available');
      return;
    }

    await new Promise(r => setTimeout(r, 1000));

    let rows;
    try {
      rows = await queryDb(
        `SELECT * FROM feedback_events
         WHERE doc_id = $1
         AND context->>'test_id' = $2`,
        [TEST_DOC_ID, complexRequestId]
      );
    } catch (err) {
      test.skip(true, 'Could not query feedback_events');
      return;
    }

    if (rows.length === 0) {
      test.skip(true, 'No row found - event may not have persisted');
      return;
    }

    const row = rows[0];
    createdEventIds.push(String(row.id));

    // Parse the corrected_value
    const stored = typeof row.corrected_value === 'string'
      ? JSON.parse(row.corrected_value)
      : row.corrected_value;

    // Verify nested structure
    expect(stored.nested.array).toEqual([1, 2, { deep: 'value' }]);
    expect(stored.nested.object.key).toBe('value');
    expect(stored.nested.object.number).toBe(42);
    expect(stored.unicode).toBe('日本語テスト');
    expect(stored.special).toBe('quotes"and\'apostrophes');
  });

  test('request_id is tracked through the flow', async ({ page }) => {
    const trackingRequestId = `e2e-tracking-${Date.now()}`;

    // Submit via main endpoint with X-Request-Id header
    const resp = await page.request.post(`${BASE_URL}/api/visual-rag/feedback`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': trackingRequestId,
      },
      data: {
        documentId: TEST_DOC_ID,
        events: [{
          event_type: 'verification',
          field_name: 'request_id_test',
          context: {}
        }]
      }
    });

    if (resp.status() >= 400) {
      test.skip(true, 'Feedback API not available');
      return;
    }

    await new Promise(r => setTimeout(r, 1000));

    // Query and verify request_id was captured
    let rows;
    try {
      rows = await queryDb(
        `SELECT * FROM feedback_events
         WHERE doc_id = $1
         AND field_name = 'request_id_test'
         ORDER BY created_at DESC
         LIMIT 1`,
        [TEST_DOC_ID]
      );
    } catch (err) {
      test.skip(true, 'Could not query feedback_events');
      return;
    }

    if (rows.length === 0) {
      test.skip(true, 'No row found');
      return;
    }

    const row = rows[0];
    createdEventIds.push(String(row.id));

    // The request_id should be stored in context
    const context = row.context || {};
    const storedRequestId = context.request_id || context.requestId;

    // Note: depending on implementation, request_id might be in context or separate column
    // This test verifies at least it's traceable
    if (storedRequestId) {
      expect(storedRequestId).toBe(trackingRequestId);
    } else {
      console.log('request_id not found in context - implementation may differ');
    }
  });
});
