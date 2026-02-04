const request = require('supertest');
const assert = require('assert');

describe('Legacy chat endpoints', function () {
  before(function () {
    // require server
    this.app = require('../../server');
  });

  it('GET /chat/init/:id returns 410', async function () {
    const res = await request(this.app)
      .get('/chat/init/42')
      .expect(410);

    assert.ok(res.text.includes('Legacy route retired'));
  });
});
