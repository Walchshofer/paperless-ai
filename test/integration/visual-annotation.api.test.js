const assert = require('assert');
const request = require('supertest');
const app = require('../../server');
const feedbackService = require('../../services/feedback/FeedbackService');
const qdrant = require('../../services/visual-rag-client/QdrantAdapter');

describe('Visual Annotation API (stubbed) - /api/visual-rag/feedback', function () {
  it('accepts annotation and mirrors payload into Qdrant (stubbed)', async function () {
    const qCalls = [];
    const origUpsert = qdrant.qdrantAdapter.upsertVisualOverlays;
    qdrant.qdrantAdapter.upsertVisualOverlays = async (points) => {
      qCalls.push(points);
      return { status: 'ok' };
    };

    // Fake client to simulate DB behavior
    const client = {
      queries: [],
      async query(sql, params) {
        this.queries.push({ sql, params });
        const s = sql.trim();
        if (s.startsWith('BEGIN')) return { rows: [] };
        if (s.startsWith('INSERT INTO visual_overlays')) return { rows: [{ id: 314 }] };
        if (s.startsWith('UPDATE visual_overlays SET vector_id')) return { rows: [{ vector_id: params[0] }] };
        if (s.startsWith('INSERT INTO feedback_events')) return { rows: [{ id: 19 }] };
        if (s.startsWith('COMMIT')) return { rows: [] };
        return { rows: [] };
      },
      release() { /* no-op */ }
    };

    const fakePool = {
      async connect() { return client; }
    };

    // Inject the fake pool into the singleton service
    const origPool = feedbackService._pool;
    feedbackService._pool = fakePool;

    const docId = 555;
    const events = [
      {
        type: 'annotation',
        field: 'total_amount',
        context: {
          bbox: [5, 6, 7, 8],
          correspondent_id: 777,
          tag_ids: [11, 12],
          page: 3
        }
      }
    ];

    const resp = await request(app)
      .post('/api/visual-rag/feedback')
      .set('x-request-id', `test-${Date.now()}`)
      .send({ documentId: docId, events })
      .expect(200);

    assert.strictEqual(resp.body.success, true);
    // Ensure qdrant was called
    assert.ok(qCalls.length === 1);
    const pt = qCalls[0][0];
    assert.strictEqual(pt.payload.doc_id, docId);
    assert.strictEqual(pt.payload.correspondent_id, 777);
    assert.ok(Array.isArray(pt.payload.tag_ids) && pt.payload.tag_ids.includes(11));
    assert.strictEqual(pt.payload.page_number, 3);
    assert.strictEqual(pt.payload.semantic_label, 'total_amount');

    // Restore
    qdrant.qdrantAdapter.upsertVisualOverlays = origUpsert;
    feedbackService._pool = origPool;
  });
});
