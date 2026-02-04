const assert = require('assert');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const token = jwt.sign({ id: 1, username: 'test' }, process.env.JWT_SECRET);

function injectMock(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports
  };
}

describe('Chat API fallback', function () {
  let app;

  before(function () {
    injectMock('../../services/aiServiceFactory', {
      getService: () => ({
        chat: async () => {
          throw new Error('chat failed');
        },
        generateText: async () => 'fallback ok'
      })
    });

    injectMock('../../services/paperlessService', {
      getDocument: async (id) => ({ id, title: 'Doc X' }),
      getDocumentContent: async () => 'Document content'
    });

    const routerPath = require.resolve('../../routes/api/chat');
    delete require.cache[routerPath];
    const chatRouter = require('../../routes/api/chat');

    app = express();
    app.use(express.json());
    app.use('/api/chat', chatRouter);
  });

  it('uses generateText when generateCompletion is missing', async function () {
    const res = await request(app)
      .post('/api/chat/document')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'What is this?',
        model: 'gpt-oss:latest',
        documentId: 123
      })
      .expect(200);

    assert.strictEqual(res.body.response, 'fallback ok');
  });
});
