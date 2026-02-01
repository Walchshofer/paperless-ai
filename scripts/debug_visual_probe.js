const request = require('supertest');
const app = require('../server');
(async () => {
  try {
    const res = await request(app).post('/api/visual-rag/search/visual').send({ image: 'VGhpcyBpcyBhIHRlc3QgYmFzZTY0IHN0cmluZy4=', collection: 'visual_pages' });
    console.log('STATUS', res.status);
    console.log('HEADERS', res.headers);
    console.log('TEXT_START', (res.text || '').slice(0, 1000));
    if (res.body) console.log('BODY_KEYS', Object.keys(res.body));
  } catch (err) {
    console.error('ERR', err && err.message);
    console.error(err && err.stack);
  }
})();