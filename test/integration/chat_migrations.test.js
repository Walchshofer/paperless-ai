/* eslint-env mocha */

/**
 * Chat Migrations Integration Tests
 *
 * Service dependencies: PostgreSQL (paperless_db / POSTGRES_HOST)
 *
 * Running modes:
 *   - Container-native: POSTGRES_HOST=db (or paperless_db) + credentials
 *   - Host-side: POSTGRES_HOST=localhost + credentials
 *   - Skipped automatically: missing credentials OR DB unreachable (5s timeout)
 *
 * Environment variables:
 *   POSTGRES_URL      — full connection string (takes precedence)
 *   POSTGRES_HOST     — DB hostname (default: localhost)
 *   POSTGRES_PORT     — DB port (default: 5432)
 *   POSTGRES_DB       — DB name
 *   POSTGRES_USER     — DB user
 *   POSTGRES_PASSWORD — DB password
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

describe('Chat Migrations', function() {
  // Bounded timeout: connection attempt (5s) + migration query headroom
  this.timeout(20000);

  it('creates and rolls back chat tables', async function() {
    const url = process.env.POSTGRES_URL;
    const host = process.env.POSTGRES_HOST || 'localhost';
    const port = process.env.POSTGRES_PORT || '5432';
    const database = process.env.POSTGRES_DB;
    const user = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;
    if (!url && (!database || !user || !password)) this.skip();

    const clientConfig = url
      ? { connectionString: url, connectionTimeoutMillis: 5000 }
      : { host, port, database, user, password, connectionTimeoutMillis: 5000 };
    const client = new Client(clientConfig);
    try {
      await client.connect();
    } catch (err) {
      console.log('[chat_migrations] Skipping: DB not reachable -', err.message);
      this.skip();
      return;
    }
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
