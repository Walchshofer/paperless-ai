/* eslint-env mocha */
const assert = require('assert');
const request = require('supertest');
const documentModel = require('../../services/documentModel');
const { createScopedRouteApp } = require('../helpers/scoped-route-auth');

function buildFeedbackApp(user) {
  return createScopedRouteApp({
    routePath: require.resolve('../../routes/api/feedback'),
    mountPath: '/api/feedback',
    user,
    authOverrides: {
      requireAdmin: (req, res, next) => next(),
    },
    jsonOptions: {},
  });
}

describe('Feedback field-vote endpoint', function () {
  it('returns 401 when unauthenticated', async function () {
    const app = buildFeedbackApp(null);

    await request(app)
      .post('/api/feedback/field-vote')
      .send({ documentId: 1, fieldId: 'title', vote: 'up' })
      .expect(401);
  });

  it('records field vote for authenticated user', async function () {
    const app = buildFeedbackApp({ id: 1, username: 'tester' });
    const orig = documentModel.insertFeedback;
    let captured = null;

    try {
      documentModel.insertFeedback = async (payload) => {
        captured = payload;
        return { id: 999, ...payload };
      };

      const resp = await request(app)
        .post('/api/feedback/field-vote')
        .send({ documentId: 123, fieldId: 'invoice_total', vote: 'up' })
        .expect(200);

      assert.strictEqual(resp.body.success, true);
      assert.ok(captured, 'insertFeedback called');
      assert.strictEqual(captured.event_type, 'field_vote');
      assert.strictEqual(captured.field_name, 'invoice_total');
      assert.strictEqual(captured.corrected_value, 'up');
      const ctx = typeof captured.context === 'string'
        ? JSON.parse(captured.context || '{}')
        : (captured.context || {});
      assert.strictEqual(ctx.username, 'tester');
    } finally {
      documentModel.insertFeedback = orig;
    }
  });
});
