const assert = require('assert');
const { ChatRepository } = require('../../services/repositories/chatRepository');

// A minimal fake client to simulate pg Pool
function makeFakePool({ selectSessionExists = false, maxIdx = 1 } = {}) {
  return {
    connect: async () => ({
      query: async (sql, _params) => {
        // Simulate behavior based on SQL
        if (sql.includes('SELECT id FROM chat_sessions')) {
          return { rows: selectSessionExists ? [{ id: 'existing-session-uuid' }] : [] };
        }
        if (sql.startsWith('INSERT INTO chat_sessions')) {
          return { rows: [{ id: 'new-session-uuid' }] };
        }
        if (sql.includes('COALESCE(MAX(message_index)')) {
          return { rows: [{ max_idx: maxIdx }] };
        }
        if (sql.startsWith('INSERT INTO chat_messages')) {
          return { rows: [{ id: 'msg-uuid', created_at: new Date().toISOString() }] };
        }
        if (sql.startsWith('SELECT id, role')) {
          return { rows: [{ id: 'msg-uuid', role: 'user', content: 'hello', metadata: null, message_index: 0, created_at: new Date().toISOString() }] };
        }
        return { rows: [] };
      },
      release: () => {}
    })
  };
}

describe('ChatRepository (unit, fake DB)', function() {
  it('creates session when none exists and appends messages', async function() {
    const fakePool = makeFakePool({ selectSessionExists: false, maxIdx: 1 });
    const repo = new ChatRepository(fakePool);

    const sid = await repo.getOrCreateSession(null);
    assert.strictEqual(sid, 'new-session-uuid');

    const msg = await repo.appendMessage('new-session-uuid', 'user', 'Hello', { foo: 'bar' });
    assert.ok(msg.id === 'msg-uuid');
    assert.strictEqual(msg.message_index, 2);

    const messages = await repo.getMessages('new-session-uuid');
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].content, 'hello');
  });

  it('handles max_idx === 0 correctly and produces message_index 1', async function() {
    const fakePool = makeFakePool({ selectSessionExists: false, maxIdx: 0 });
    const repo = new ChatRepository(fakePool);

    const sid = await repo.getOrCreateSession(null);
    assert.strictEqual(sid, 'new-session-uuid');

    const msg = await repo.appendMessage('new-session-uuid', 'user', 'First', { foo: 'bar' });
    assert.ok(msg.id === 'msg-uuid');
    assert.strictEqual(msg.message_index, 1); // 0 -> nextIndex should be 1
  });

  it('returns existing session when present', async function() {
    const fakePool = makeFakePool({ selectSessionExists: true });
    const repo = new ChatRepository(fakePool);

    const sid = await repo.getOrCreateSession(123);
    assert.strictEqual(sid, 'existing-session-uuid');
  });
});
