const request = require('supertest');

describe('Legacy route retirement (integration)', function () {
  before(function () {
    this.app = require('../../server');
  });

  it('GET /manual returns 410', async function () {
    const res = await request(this.app).get('/manual');
    if (res.status !== 410) {
      throw new Error(`Expected 410, got ${res.status}`);
    }
  });

  it('GET /chat returns 410', async function () {
    const res = await request(this.app).get('/chat');
    if (res.status !== 410) {
      throw new Error(`Expected 410, got ${res.status}`);
    }
  });

  it('GET /rag returns 410', async function () {
    const res = await request(this.app).get('/rag');
    if (res.status !== 410) {
      throw new Error(`Expected 410, got ${res.status}`);
    }
  });
});
