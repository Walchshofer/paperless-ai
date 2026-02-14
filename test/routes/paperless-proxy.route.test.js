/* eslint-env mocha */
const assert = require('assert');
const express = require('express');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { Readable } = require('stream');
const axios = require('axios');
const config = require('../../config/config');

const ROUTE_PATH = require.resolve('../../routes/api/paperless-proxy');
const AUTH_MODULE_PATH = require.resolve('../../middleware/auth');

function buildApp(user) {
  const originalAuthModule = require.cache[AUTH_MODULE_PATH];
  const originalRouteModule = require.cache[ROUTE_PATH];

  require.cache[AUTH_MODULE_PATH] = {
    id: AUTH_MODULE_PATH,
    filename: AUTH_MODULE_PATH,
    loaded: true,
    exports: {
      authenticateApi: (req, res, next) => {
        if (!user) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'No valid authentication token provided',
          });
        }
        req.user = {
          id: user.id,
          username: user.username,
          role: user.role || 'user',
        };
        return next();
      },
    },
  };

  delete require.cache[ROUTE_PATH];
  const route = require(ROUTE_PATH);

  if (originalAuthModule) {
    require.cache[AUTH_MODULE_PATH] = originalAuthModule;
  } else {
    delete require.cache[AUTH_MODULE_PATH];
  }

  if (originalRouteModule) {
    require.cache[ROUTE_PATH] = originalRouteModule;
  } else {
    delete require.cache[ROUTE_PATH];
  }

  const app = express();
  app.use(express.json());
  app.use('/api/proxied/paperless', route);
  return app;
}

describe('Paperless proxy route', function () {
  let originalAxiosRequest;

  beforeEach(function () {
    originalAxiosRequest = axios.request;
    config.clearRuntimeOverrides();
  });

  afterEach(function () {
    axios.request = originalAxiosRequest;
    config.clearRuntimeOverrides();
  });

  it('returns 401 when unauthenticated', async function () {
    const app = buildApp(null);
    const response = await request(app)
      .get('/api/proxied/paperless/documents/74/download/original/')
      .expect(401);

    assert.strictEqual(response.body.error, 'Authentication required');
  });

  it('server mounts /api/proxied/paperless route', function () {
    const serverPath = path.join(__dirname, '..', '..', 'server.js');
    const source = fs.readFileSync(serverPath, 'utf8');

    assert.ok(
      source.includes(
        "app.use('/api/proxied/paperless', paperlessProxyRoutes);"
      ),
      'expected server.js to mount /api/proxied/paperless'
    );
  });

  it('returns 503 when Paperless URL/token is missing', async function () {
    config.updateRuntime('paperless.apiUrl', '');
    config.updateRuntime('paperless.apiToken', '');

    const app = buildApp({ id: 7, username: 'debug', role: 'user' });
    const response = await request(app)
      .get('/api/proxied/paperless/documents/74/download/original/')
      .expect(503);

    assert.strictEqual(response.body.error, 'Paperless proxy unavailable');
    assert.match(response.body.message, /PAPERLESS_API_URL/);
  });

  it('proxies document asset requests to Paperless API', async function () {
    config.updateRuntime('paperless.apiUrl', 'http://paperless:8000/api');
    config.updateRuntime('paperless.apiToken', 'paperless-token');

    axios.request = async (options) => {
      assert.strictEqual(options.method, 'GET');
      assert.strictEqual(
        options.url,
        'http://paperless:8000/api/documents/74/download/?page=1'
      );
      assert.strictEqual(options.headers.Authorization, 'Token paperless-token');
      assert.strictEqual(options.headers.Range, 'bytes=0-255');
      assert.strictEqual(options.responseType, 'stream');
      return {
        status: 206,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'content-range': 'bytes 0-8/9',
        },
        data: Readable.from(['proxied-ok']),
      };
    };

    const app = buildApp({ id: 7, username: 'debug', role: 'user' });
    const response = await request(app)
      .get(
        '/api/proxied/paperless/documents/74/download/original/?page=1'
      )
      .set('Range', 'bytes=0-255')
      .expect(206);

    assert.strictEqual(response.text, 'proxied-ok');
    assert.strictEqual(response.headers['content-range'], 'bytes 0-8/9');
  });

  it('proxies authenticated document list requests with 200', async function () {
    config.updateRuntime('paperless.apiUrl', 'http://paperless:8000/api');
    config.updateRuntime('paperless.apiToken', 'paperless-token');

    axios.request = async (options) => {
      assert.strictEqual(options.method, 'GET');
      assert.strictEqual(
        options.url,
        'http://paperless:8000/api/documents/?page_size=1'
      );
      assert.strictEqual(options.headers.Authorization, 'Token paperless-token');
      return {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
        data: Readable.from(['{"count":1,"results":[{"id":74}]}']),
      };
    };

    const app = buildApp({ id: 7, username: 'debug', role: 'user' });
    const response = await request(app)
      .get('/api/proxied/paperless/documents/?page_size=1')
      .expect(200);

    assert.match(response.text, /"count":1/);
  });

  it('normalizes api URL without /api suffix', function () {
    const route = require(ROUTE_PATH);
    const upstreamUrl = route._buildUpstreamUrl(
      '/api/proxied/paperless/documents/123/preview/?page=2',
      'http://paperless:8000'
    );

    assert.strictEqual(
      upstreamUrl,
      'http://paperless:8000/api/documents/123/preview/?page=2'
    );
  });

  it('normalizes /download/original/ to /download/', function () {
    const route = require(ROUTE_PATH);
    const upstreamUrl = route._buildUpstreamUrl(
      '/api/proxied/paperless/documents/74/download/original/?page=1',
      'http://paperless:8000/api'
    );

    assert.strictEqual(
      upstreamUrl,
      'http://paperless:8000/api/documents/74/download/?page=1'
    );
  });
});
