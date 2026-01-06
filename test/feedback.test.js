const assert = require('assert');
const documentModel = require('../models/document');

describe('Feedback events', function () {
  it('inserts, retrieves pending feedback and marks processed', async function () {
    // Use a large temporary document id unlikely to collide
    const docId = 9999999;

    const insertedId = await documentModel.insertFeedback({
      doc_id: docId,
      user_id: 1,
      event_type: 'correction',
      field_name: 'title',
      original_value: 'Inv 1',
      corrected_value: 'Invoice 1',
      context: { page: 1 }
    });

    assert.ok(insertedId, 'insertFeedback should return an id');

    const pending = await documentModel.getPendingFeedback(20);
    assert.ok(Array.isArray(pending), 'getPendingFeedback should return an array');

    const found = pending.find(r => (r.document_id === docId || r.doc_id === docId || r.documentId === docId || r.docId === docId));
    assert.ok(found, 'Inserted feedback must be returned in pending list');

    const processed = await documentModel.markFeedbackProcessed([found.id || found.ID || found.ID]);
    assert.ok(processed >= 0, 'markFeedbackProcessed should return number of processed rows');

    // Verify it is no longer pending
    const pendingAfter = await documentModel.getPendingFeedback(20);
    const still = pendingAfter.find(r => r.id === found.id);
    assert.ok(!still, 'Processed record should not be returned by getPendingFeedback');
  });

  it('handles object-valued corrected_value and accepts document_id field', async function () {
    const docId1 = 1000001;

    const inserted1 = await documentModel.insertFeedback({
      doc_id: docId1,
      user_id: 2,
      event_type: 'correction',
      field_name: 'amount',
      original_value: '$10',
      corrected_value: { amount: 10, currency: 'USD' },
      context: { page: 2 }
    });

    assert.ok(inserted1, 'insertFeedback should return inserted row or id for object corrected_value');

    const pending1 = await documentModel.getPendingFeedback(20);
    const found1 = pending1.find(r => r.document_id === docId1 || r.doc_id === docId1 || r.documentId === docId1 || r.docId === docId1);
    assert.ok(found1, 'Inserted object-valued feedback must be returned in pending list');

    // corrected_value should be a JSON string that parses to the original object
    assert.ok(typeof found1.corrected_value === 'string' || found1.corrected_value === null);
    if (found1.corrected_value) {
      const parsed = JSON.parse(found1.corrected_value);
      assert.strictEqual(parsed.amount, 10);
      assert.strictEqual(parsed.currency, 'USD');
    }

    // context should be a JSON string that parses to the original object
    assert.ok(typeof found1.context === 'string' || found1.context === null);
    if (found1.context) {
      const ctx = JSON.parse(found1.context);
      assert.strictEqual(ctx.page, 2);
    }

    // Now test using document_id key
    const docId2 = 1000002;
    const inserted2 = await documentModel.insertFeedback({
      document_id: docId2,
      user_id: 3,
      event_type: 'correction',
      field_name: 'email',
      original_value: 'a@b.com',
      corrected_value: { local: 'a', domain: 'b.com' },
      context: { page: 3 }
    });

    assert.ok(inserted2, 'insertFeedback should accept document_id key');

    const pending2 = await documentModel.getPendingFeedback(20);
    const found2 = pending2.find(r => r.document_id === docId2 || r.doc_id === docId2 || r.documentId === docId2 || r.docId === docId2);
    assert.ok(found2, 'Inserted document_id feedback must be returned in pending list');
    if (found2.corrected_value) {
      const parsed2 = JSON.parse(found2.corrected_value);
      assert.strictEqual(parsed2.local, 'a');
      assert.strictEqual(parsed2.domain, 'b.com');
    }

    // mark processed
    await documentModel.markFeedbackProcessed([found1.id || found1.ID || found1.ID, found2.id || found2.ID || found2.ID]);

  });

});