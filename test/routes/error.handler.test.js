const request = require('supertest');
const assert = require('assert');
const app = require('../../server');

describe('Global error handler', () => {
  it('returns 404 for unknown routes with friendly message', async () => {
    const res = await request(app).get('/this-route-definitely-does-not-exist');
    assert.strictEqual(res.status, 404);
    assert.ok(res.text.includes('Page not found') || res.text.includes('Error 404'));
  });

  it('returns 500 for thrown errors and renders friendly message', async () => {
    // install a temporary route that throws
    app.get('/__test/error', (req, res) => {
      throw new Error('test error');
    });

    const res = await request(app).get('/__test/error');
    assert.strictEqual(res.status, 500);
    assert.ok(res.text.includes('An unexpected error occurred') || res.text.includes('Error 500'));
  });

  it('returns JSON for API errors', async () => {
    app.get('/api/__test/error', (req, res) => {
      throw new Error('api error');
    });

    const res = await request(app).get('/api/__test/error');
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body && res.body.error, 'internal_error');
  });
});