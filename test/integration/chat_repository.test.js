const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const chatRepository = require('../../services/repositories/chatRepository');

describe('ChatRepository Integration', function() {
  it('persists messages and retrieves them', async function() {
    const url = process.env.POSTGRES_URL;
    const host = process.env.POSTGRES_HOST;
    const port = process.env.POSTGRES_PORT || '5432';
    const database = process.env.POSTGRES_DB;
    const user = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;
    if (!url && (!host || !database || !user || !password)) this.skip();

    // Apply migration
    const client = url ? new Client({ connectionString: url }) : new Client({ host, port, database, user, password });
    await client.connect();
    try {
      const migrationSql = fs.readFileSync(path.join(process.cwd(), 'migrations/006_create_chat_schema.sql'), 'utf8');
      await client.query(migrationSql);

      // Create a session (null document)
      const sessionId = await chatRepository.getOrCreateSession(null);
      assert.ok(sessionId, 'sessionId should be returned');

      // Append user and assistant messages
      await chatRepository.appendMessage(sessionId, 'user', 'Hello world');
      await chatRepository.appendMessage(sessionId, 'assistant', 'Hi there');

      const msgs = await chatRepository.getMessages(sessionId, 10, 0);
      assert.strictEqual(msgs.length, 2);
      assert.strictEqual(msgs[0].role, 'user');
      assert.strictEqual(msgs[0].content, 'Hello world');
      assert.strictEqual(msgs[1].role, 'assistant');

      // Delete thread
      const ok = await chatRepository.deleteThread(sessionId);
      assert.strictEqual(ok, true);

      // Rollback migration
      const rollbackSql = fs.readFileSync(path.join(process.cwd(), 'migrations/006_rollback_chat_schema.sql'), 'utf8');
      await client.query(rollbackSql);

      const r1 = await client.query("SELECT to_regclass('public.chat_sessions') as t");
      const r2 = await client.query("SELECT to_regclass('public.chat_messages') as t");
      assert.strictEqual(r1.rows[0].t, null);
      assert.strictEqual(r2.rows[0].t, null);
    } finally {
      await client.end();
    }
  });
});
