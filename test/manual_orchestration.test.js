const assert = require('assert');
const request = require('supertest');
const app = require('../server');

const paperlessService = require('../services/paperlessService');
const feedbackService = require('../services/feedback/FeedbackService');

describe('Manual Orchestration Route /manual/updateDocument', function() {
  it('should update Paperless and persist feedback (best-effort) when feedback fails', async function() {
    const docId = 12345;
    // Stub paperless update to succeed
    const origUpdate = paperlessService.updateDocument;
    paperlessService.updateDocument = async (documentId) => ({ success: true, id: documentId, tags: [1,2], correspondent: 5 });

    // Provide original doc with different tags/correspondent so we trigger Qdrant sync
    const origGet = paperlessService.getDocument;
    paperlessService.getDocument = async (id) => ({ id, tags: [1], correspondent: null });

    // Stub feedbackService to fail
    const origFeedback = feedbackService.recordGranularFeedback;
    feedbackService.recordGranularFeedback = async () => ({ errors: [{ type: 'insertion', error: 'DB down' }] });

    // Stub QdrantAdapter and metrics
    const qdrant = require('../services/visual-rag-client/QdrantAdapter');
    const origUpdatePayload = qdrant.qdrantAdapter.updatePayloadForDoc;
    let qCalled = false;
    qdrant.qdrantAdapter.updatePayloadForDoc = async (collectionName, id, payload) => { qCalled = true; return { status: 'ok', updated: 1 }; };

    const { metricsCollector } = require('../services/metrics/PrometheusMetrics');
    const origRecord = metricsCollector.recordQdrantPayloadSync;
    let metricCalled = false;
    metricsCollector.recordQdrantPayloadSync = (c) => { metricCalled = true; };

    const res = await request(app)
      .post('/manual/updateDocument')
      .set('X-Request-Id', 'test-req-1')
      .send({ documentId: docId, document_updates: { title: 'New Title' }, feedback_events: [{ type: 'correction' }] });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.success || res.body.id || res.body, 'expected success payload');

    // allow for async qdrant sync to run
    await new Promise(r => setTimeout(r, 100));

    assert.strictEqual(qCalled, true, 'expected qdrant payload sync to be called');
    assert.strictEqual(metricCalled, true, 'expected metric to be recorded');

    // cleanup
    paperlessService.updateDocument = origUpdate;
    paperlessService.getDocument = origGet;
    feedbackService.recordGranularFeedback = origFeedback;
    qdrant.qdrantAdapter.updatePayloadForDoc = origUpdatePayload;
    metricsCollector.recordQdrantPayloadSync = origRecord;
  });

  it('should abort and not update Paperless if transactional and feedback persists fails', async function() {
    const docId = 22222;
    // Stub paperless update to throw if called (it should not be called)
    const origUpdate = paperlessService.updateDocument;
    paperlessService.updateDocument = async () => { throw new Error('should not be called'); };

    // Stub feedbackService to return errors
    const origFeedback = feedbackService.recordGranularFeedback;
    feedbackService.recordGranularFeedback = async () => ({ errors: [{ type: 'insertion', error: 'DB down' }] });

    const res = await request(app)
      .post('/manual/updateDocument')
      .set('X-Request-Id', 'test-req-2')
      .send({ documentId: docId, transactional: true, document_updates: { title: 'New Title' }, feedback_events: [{ type: 'correction' }] });

    assert.strictEqual(res.status, 500);

    // cleanup
    paperlessService.updateDocument = origUpdate;
    feedbackService.recordGranularFeedback = origFeedback;
  });

  it('should succeed transactionally when feedback persists and then Paperless update succeeds', async function() {
    const docId = 33333;
    // Stub feedback to succeed
    const origFeedback = feedbackService.recordGranularFeedback;
    feedbackService.recordGranularFeedback = async () => ({ inserted: ['id1'] });

    // Stub paperless update to succeed and return no tag/correspondent change
    const origUpdate = paperlessService.updateDocument;
    let updateCalled = false;
    paperlessService.updateDocument = async (documentId) => { updateCalled = true; return { success: true, id: documentId, tags: [1], correspondent: null }; };

    // Original doc matching updated doc (no changes)
    const origGet = paperlessService.getDocument;
    paperlessService.getDocument = async (id) => ({ id, tags: [1], correspondent: null });

    // Stub QdrantAdapter and metrics to assert NOT called
    const qdrant = require('../services/visual-rag-client/QdrantAdapter');
    const origUpdatePayload = qdrant.qdrantAdapter.updatePayloadForDoc;
    let qCalled = false;
    qdrant.qdrantAdapter.updatePayloadForDoc = async () => { qCalled = true; return { status: 'ok', updated: 0 }; };

    const { metricsCollector } = require('../services/metrics/PrometheusMetrics');
    const origRecord = metricsCollector.recordQdrantPayloadSync;
    let metricCalled = false;
    metricsCollector.recordQdrantPayloadSync = (c) => { metricCalled = true; };

    const res = await request(app)
      .post('/manual/updateDocument')
      .set('X-Request-Id', 'test-req-3')
      .send({ documentId: docId, transactional: true, document_updates: { title: 'OK' }, feedback_events: [{ type: 'annotation', context: { bbox: [1,2,3,4], page: 1 } }] });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(updateCalled, true);

    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(qCalled, false, 'qdrant sync should not be called when tags/correspondent unchanged');
    assert.strictEqual(metricCalled, false, 'metric should not be recorded when no sync');

    // cleanup
    feedbackService.recordGranularFeedback = origFeedback;
    paperlessService.updateDocument = origUpdate;
    paperlessService.getDocument = origGet;
    qdrant.qdrantAdapter.updatePayloadForDoc = origUpdatePayload;
    metricsCollector.recordQdrantPayloadSync = origRecord;
  });
});
