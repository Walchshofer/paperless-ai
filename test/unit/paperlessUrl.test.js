const assert = require('assert');
const {
  getPaperlessBaseUrl,
  buildPaperlessDocumentUrl
} = require('../../services/utils/paperlessUrl');

describe('paperlessUrl utilities', function () {
  const originalUrl = process.env.PAPERLESS_API_URL;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.PAPERLESS_API_URL;
    } else {
      process.env.PAPERLESS_API_URL = originalUrl;
    }
  });

  it('returns null when PAPERLESS_API_URL is not set', function () {
    delete process.env.PAPERLESS_API_URL;
    assert.strictEqual(getPaperlessBaseUrl(null), null);
  });

  it('strips /api suffix and trailing slash', function () {
    process.env.PAPERLESS_API_URL = 'http://localhost:8000/api/';
    assert.strictEqual(getPaperlessBaseUrl(), 'http://localhost:8000');
  });

  it('builds document URLs using the base URL', function () {
    process.env.PAPERLESS_API_URL = 'http://localhost:8000/api';
    assert.strictEqual(
      buildPaperlessDocumentUrl(42, '/download/'),
      'http://localhost:8000/documents/42/download/'
    );
  });

  it('returns null when base URL is missing', function () {
    delete process.env.PAPERLESS_API_URL;
    assert.strictEqual(buildPaperlessDocumentUrl(42, '/download/', null), null);
  });

  it('normalizes path suffix without a leading slash', function () {
    process.env.PAPERLESS_API_URL = 'http://localhost:8000/api';
    assert.strictEqual(
      buildPaperlessDocumentUrl(7, 'download/'),
      'http://localhost:8000/documents/7/download/'
    );
  });
});
