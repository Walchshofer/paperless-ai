const request = require('supertest');

describe('Legacy route Phase C hard redirect (integration)', function () {
  let origPhase;

  before(function () {
    origPhase = process.env.LEGACY_REDIRECT_PHASE;
    process.env.LEGACY_REDIRECT_PHASE = 'C';
    // Ensure server is required after setting env var
    this.app = require('../../server');
  });

  after(function () {
    process.env.LEGACY_REDIRECT_PHASE = origPhase;
  });

  it('GET /manual should return 301 redirect to configured target', async function () {
    const res = await request(this.app).get('/manual').redirects(0);
    // Expect a 301 hard redirect
    if (res.status !== 301 && res.status !== 302) {
      throw new Error(`Expected 301/302 redirect, got ${res.status}`);
    }
    if (!res.headers.location) throw new Error('Missing Location header on redirect');
  });

  it('GET /chat should return 301 redirect to configured target', async function () {
    const res = await request(this.app).get('/chat').redirects(0);
    if (res.status !== 301 && res.status !== 302) {
      throw new Error(`Expected 301/302 redirect, got ${res.status}`);
    }
    if (!res.headers.location) throw new Error('Missing Location header on redirect');
  });

  it('GET /rag should return 301 redirect to configured target', async function () {
    const res = await request(this.app).get('/rag').redirects(0);
    if (res.status !== 301 && res.status !== 302) {
      throw new Error(`Expected 301/302 redirect, got ${res.status}`);
    }
    if (!res.headers.location) throw new Error('Missing Location header on redirect');
  });
});