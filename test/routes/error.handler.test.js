/* eslint-env mocha */

const express = require('express');
const request = require('supertest');
const assert = require('assert');

function attachGlobal404AndErrorHandlers(app) {
  // Mirror server.js 404 forwarder behavior.
  app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  // Mirror server.js API/non-API error response contracts.
  app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;

    if (req && req.originalUrl && req.originalUrl.startsWith('/api')) {
      return res.status(status).json({
        error: status === 404 ? 'not_found' : 'internal_error',
        message: status === 404 ? 'Resource not found' : 'Internal server error'
      });
    }

    const friendlyMessage = status === 404
      ? 'Page not found'
      : 'An unexpected error occurred';
    return res.status(status).send(friendlyMessage);
  });
}

function createHarnessApp() {
  const app = express();

  app.get('/__test/error', () => {
    throw new Error('test error');
  });

  app.get('/api/__test/error', () => {
    throw new Error('api error');
  });

  attachGlobal404AndErrorHandlers(app);
  return app;
}

describe('Global error handler', () => {
  it('returns 404 for unknown routes with friendly message', async () => {
    const app = createHarnessApp();
    const res = await request(app).get('/this-route-definitely-does-not-exist');

    assert.strictEqual(res.status, 404);
    assert.ok(res.text.includes('Page not found'));
  });

  it('returns 500 for thrown non-API errors with friendly message', async () => {
    const app = createHarnessApp();
    const res = await request(app).get('/__test/error');

    assert.strictEqual(res.status, 500);
    assert.ok(res.text.includes('An unexpected error occurred'));
  });

  it('returns JSON for API errors', async () => {
    const app = createHarnessApp();
    const res = await request(app).get('/api/__test/error');

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body && res.body.error, 'internal_error');
    assert.strictEqual(res.body && res.body.message, 'Internal server error');
  });
});
