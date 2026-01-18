const assert = require('assert');
const feedbackService = require('../../services/feedback/FeedbackService');
const qdrant = require('../../services/visual-rag-client/QdrantAdapter');

describe('FeedbackService.recordGranularFeedback - Payload Mirroring', function () {
  it('inserts overlay and calls Qdrant upsert with mirrored payload', async function () {
    const calls = [];

    // Stub Qdrant upsert to capture the point passed
    const origUpsert = qdrant.qdrantAdapter.upsertVisualOverlays;
    qdrant.qdrantAdapter.upsertVisualOverlays = async (points) => {
      calls.push({ points });
      return { status: 'ok' };
    };

    // Fake client that handles queries in sequence
    const client = {
      queries: [],
      async query(sql, params) {
        this.queries.push({ sql, params });
        const s = sql.trim();
        if (s.startsWith('BEGIN')) return { rows: [] };
        if (s.startsWith('INSERT INTO visual_overlays')) return { rows: [{ id: 42 }] };
        if (s.startsWith('UPDATE visual_overlays SET vector_id')) return { rows: [{ vector_id: params[0] }] };
        if (s.startsWith('INSERT INTO feedback_events')) return { rows: [{ id: 7 }] };
        if (s.startsWith('COMMIT')) return { rows: [] };
        // Default
        return { rows: [] };
      },
      release() { /* no-op */ }
    };

    const docId = 101;
    const events = [
      {
        type: 'annotation',
        field: 'invoice_date',
        context: {
          bbox: [10, 20, 30, 40],
          correspondentId: 123,
          tagIds: [9, '8'],
          page: 2
        }
      }
    ];

    const res = await feedbackService.recordGranularFeedback(docId, events, { client });

    // Validate results
    assert.ok(res.overlays.length === 1, 'overlay should be recorded');
    assert.ok(calls.length === 1, 'qdrant should be called once');

    const point = calls[0].points[0];
    assert.strictEqual(point.payload.doc_id, docId);
    assert.strictEqual(point.payload.correspondent_id, 123);
    assert.ok(Array.isArray(point.payload.tag_ids) && point.payload.tag_ids.includes(9));
    assert.strictEqual(point.payload.page_number, 2);
    assert.strictEqual(point.payload.semantic_label, 'invoice_date');

    // Restore
    qdrant.qdrantAdapter.upsertVisualOverlays = origUpsert;
  });

  it('normalizes tag ids when passed as mixed values', async function () {
    const calls = [];
    const origUpsert = qdrant.qdrantAdapter.upsertVisualOverlays;
    qdrant.qdrantAdapter.upsertVisualOverlays = async (points) => {
      calls.push(points);
      return { status: 'ok' };
    };

    const client = {
      queries: [],
      async query(sql, params) {
        this.queries.push({ sql, params });
        const s = sql.trim();
        if (s.startsWith('BEGIN')) return { rows: [] };
        if (s.startsWith('INSERT INTO visual_overlays')) return { rows: [{ id: 99 }] };
        if (s.startsWith('UPDATE visual_overlays SET vector_id')) return { rows: [{ vector_id: params[0] }] };
        if (s.startsWith('INSERT INTO feedback_events')) return { rows: [{ id: 8 }] };
        if (s.startsWith('COMMIT')) return { rows: [] };
        return { rows: [] };
      },
      release() { /* no-op */ }
    };

    const docId = 202;
    const events = [
      {
        type: 'annotation',
        field: 'vendor_name',
        context: {
          bbox: [1, 2, 3, 4],
          tagIds: ['abc', { id: 5 }, '6']
        }
      }
    ];

    const res = await feedbackService.recordGranularFeedback(docId, events, { client });
    assert.ok(res.overlays.length === 1);
    assert.ok(calls.length === 1);

    const tag_ids = calls[0][0].payload.tag_ids;
    // Should contain only numeric tag ids (5 and 6)
    assert.ok(Array.isArray(tag_ids) && tag_ids.includes(5) && tag_ids.includes(6));

    qdrant.qdrantAdapter.upsertVisualOverlays = origUpsert;
  });

  it('records a deferred_ingest when Qdrant upsert fails', async function () {
    // Make Qdrant upsert throw to exercise deferred ingestion path
    const origUpsert = qdrant.qdrantAdapter.upsertVisualOverlays;
    qdrant.qdrantAdapter.upsertVisualOverlays = async () => { throw new Error('Sidecar unavailable (503)'); };

    const client = {
      queries: [],
      async query(sql, params) {
        this.queries.push({ sql, params });
        const s = sql.trim();
        if (s.startsWith('BEGIN')) return { rows: [] };
        if (s.startsWith('INSERT INTO visual_overlays')) return { rows: [{ id: 7 }] };
        if (s.startsWith('INSERT INTO feedback_events')) return { rows: [{ id: 99 }] };
        if (s.startsWith('COMMIT')) return { rows: [] };
        return { rows: [] };
      },
      release() { /* no-op */ }
    };

    const docId = 303;
    const events = [
      {
        type: 'annotation',
        field: 'invoice_number',
        context: { bbox: [0, 0, 10, 10], page: 1 }
      }
    ];

    const res = await feedbackService.recordGranularFeedback(docId, events, { client });
    // Expect an error entry indicating deferred_ingest
    assert.ok(Array.isArray(res.errors) && res.errors.some(e => e.type && e.type.startsWith('deferred')));

    qdrant.qdrantAdapter.upsertVisualOverlays = origUpsert;
  });
});
