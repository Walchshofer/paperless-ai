const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

describe('Chat Migrations', function() {
  it('creates and rolls back chat tables', async function() {
    const url = process.env.POSTGRES_URL;
    const host = process.env.POSTGRES_HOST;
    const port = process.env.POSTGRES_PORT || '5432';
    const database = process.env.POSTGRES_DB;
    const user = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;
    if (!url && (!host || !database || !user || !password)) this.skip();

    const client = url ? new Client({ connectionString: url }) : new Client({ host, port, database, user, password });
    await client.connect();
    try {
      // Apply migration
      const migrationSql = fs.readFileSync(path.join(process.cwd(), 'migrations/006_create_chat_schema.sql'), 'utf8');
      await client.query(migrationSql);

      // Verify tables exist
      const res1 = await client.query("SELECT to_regclass('public.chat_sessions') as t");
      const res2 = await client.query("SELECT to_regclass('public.chat_messages') as t");
      assert.ok(res1.rows[0].t, 'chat_sessions table missing');
      assert.ok(res2.rows[0].t, 'chat_messages table missing');

      // Rollback
      const rollbackSql = fs.readFileSync(path.join(process.cwd(), 'migrations/006_rollback_chat_schema.sql'), 'utf8');
      await client.query(rollbackSql);

      const r1 = await client.query("SELECT to_regclass('public.chat_sessions') as t");
      const r2 = await client.query("SELECT to_regclass('public.chat_messages') as t");
      assert.strictEqual(r1.rows[0].t, null, 'chat_sessions should be dropped');
      assert.strictEqual(r2.rows[0].t, null, 'chat_messages should be dropped');
    } finally {
      await client.end();
    }
  });
});
