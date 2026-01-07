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
    paperlessService.updateDocument = async (documentId, _updates, _options) => ({ success: true, id: documentId });

    // Stub feedbackService to fail
    const origFeedback = feedbackService.recordGranularFeedback;
    feedbackService.recordGranularFeedback = async (documentId, _events, _options) => ({ errors: [{ type: 'insertion', error: 'DB down' }] });

    const res = await request(app)
      .post('/manual/updateDocument')
      .set('X-Request-Id', 'test-req-1')
      .send({ documentId: docId, document_updates: { title: 'New Title' }, feedback_events: [{ type: 'correction' }] });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.success || res.body.id || res.body, 'expected success payload');

    // cleanup
    paperlessService.updateDocument = origUpdate;
    feedbackService.recordGranularFeedback = origFeedback;
  });

  it('should abort and not update Paperless if transactional and feedback persists fails', async function() {
    const docId = 22222;
    // Stub paperless update to throw if called (it should not be called)
    const origUpdate = paperlessService.updateDocument;
    paperlessService.updateDocument = async () => { throw new Error('should not be called'); };

    // Stub feedbackService to return errors
    const origFeedback = feedbackService.recordGranularFeedback;
    feedbackService.recordGranularFeedback = async (documentId, _events, _options) => ({ errors: [{ type: 'insertion', error: 'DB down' }] });

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
    feedbackService.recordGranularFeedback = async (documentId, _events, _options) => ({ inserted: ['id1'] });

    // Stub paperless update to succeed
    const origUpdate = paperlessService.updateDocument;
    let updateCalled = false;
    paperlessService.updateDocument = async (documentId, updates, options) => { updateCalled = true; return { success: true, id: documentId }; };

    const res = await request(app)
      .post('/manual/updateDocument')
      .set('X-Request-Id', 'test-req-3')
      .send({ documentId: docId, transactional: true, document_updates: { title: 'OK' }, feedback_events: [{ type: 'annotation', context: { bbox: [1,2,3,4], page: 1 } }] });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(updateCalled, true);

    // cleanup
    feedbackService.recordGranularFeedback = origFeedback;
    paperlessService.updateDocument = origUpdate;
  });
});
