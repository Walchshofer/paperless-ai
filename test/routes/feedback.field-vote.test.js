const assert = require('assert');
const request = require('supertest');
process.env.API_KEY = process.env.API_KEY || 'testkey';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 1, username: 'tester' }, process.env.JWT_SECRET);

const app = require('../../server');
const documentModel = require('../../services/documentModel');

describe('Feedback field-vote endpoint', function () {
  it('returns 401 when unauthenticated', async function () {
    await request(app)
      .post('/api/feedback/field-vote')
      .send({ documentId: 1, fieldId: 'title', vote: 'up' })
      .expect(401);
  });

  it('records field vote for authenticated user', async function () {
    const orig = documentModel.insertFeedback;
    let captured = null;
    documentModel.insertFeedback = async (payload) => {
      captured = payload;
      return { id: 999, ...payload };
    };

    const resp = await request(app)
      .post('/api/feedback/field-vote')
      .set('Authorization', `Bearer ${token}`)
      .send({ documentId: 123, fieldId: 'invoice_total', vote: 'up' })
      .expect(200);

    assert.strictEqual(resp.body.success, true);
    assert.ok(captured, 'insertFeedback called');
    assert.strictEqual(captured.event_type, 'field_vote');
    assert.strictEqual(captured.field_name, 'invoice_total');
    assert.strictEqual(captured.corrected_value, 'up');
    // context should include username
    const ctx = JSON.parse(captured.context || '{}');
    assert.strictEqual(ctx.username, 'tester');

    documentModel.insertFeedback = orig;
  });
});