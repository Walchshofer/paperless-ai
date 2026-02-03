const assert = require('assert');
const paperlessService = require('../../services/paperlessService');

describe('PaperlessService.validateConnection', function () {
  let originalClient;
  let originalInitialize;

  beforeEach(() => {
    originalClient = paperlessService.client;
    originalInitialize = paperlessService.initialize;
    paperlessService.initialize = function () {};
  });

  afterEach(() => {
    paperlessService.client = originalClient;
    paperlessService.initialize = originalInitialize;
  });

  it('returns valid true when the API responds', async function () {
    paperlessService.client = {
      get: async () => ({ data: { count: 1, results: [] } })
    };

    const result = await paperlessService.validateConnection();
    assert.strictEqual(result.valid, true);
    assert.ok(result.details);
  });

  it('returns auth failure when API token is invalid', async function () {
    paperlessService.client = {
      get: async () => {
        const err = new Error('Request failed with status code 401');
        err.response = { status: 401 };
        throw err;
      }
    };

    const result = await paperlessService.validateConnection();
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error, 'Invalid API token');
    assert.strictEqual(result.details.code, 'AUTH_FAILURE');
  });

  it('returns wrong URL when endpoint is not found', async function () {
    paperlessService.client = {
      get: async () => {
        const err = new Error('Request failed with status code 404');
        err.response = { status: 404 };
        throw err;
      }
    };

    const result = await paperlessService.validateConnection();
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error, 'Cannot reach Paperless API');
    assert.strictEqual(result.details.code, 'WRONG_URL');
  });

  it('returns network error when connection fails', async function () {
    paperlessService.client = {
      get: async () => {
        const err = new Error('connect ECONNREFUSED');
        err.code = 'ECONNREFUSED';
        throw err;
      }
    };

    const result = await paperlessService.validateConnection();
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error, 'Cannot reach Paperless API');
    assert.strictEqual(result.details.code, 'NETWORK_ERROR');
  });
});
