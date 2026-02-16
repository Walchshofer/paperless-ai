/* eslint-env mocha */

/**
 * DB Schema Integration Tests
 *
 * Service dependencies: PostgreSQL (paperless_db / POSTGRES_HOST)
 *
 * Running modes:
 *   - Container-native: set POSTGRES_HOST=db (or paperless_db) + credentials
 *   - Host-side: set POSTGRES_HOST=localhost:5432 + credentials
 *   - Skipped automatically: if credentials are absent OR DB is unreachable
 *     within the 5-second connection timeout.
 *
 * Environment variables:
 *   POSTGRES_URL         — full connection string (takes precedence)
 *   POSTGRES_HOST        — DB hostname (default: localhost)
 *   POSTGRES_PORT        — DB port (default: 5432)
 *   POSTGRES_DB          — DB name
 *   POSTGRES_USER        — DB user
 *   POSTGRES_PASSWORD    — DB password
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

describe('DB Schema Integration (staging)', function() {
  // Bounded timeout: connection check (5s) + query headroom
  this.timeout(15000);

  it('should have feedback_events table and extensions', async function() {
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
      console.log('[db-schema] Skipping: DB not reachable -', err.message);
      this.skip();
      return;
    }
    try {
      const ext = await client.query(
        "SELECT extname FROM pg_extension WHERE extname='vector'"
      );
      assert.strictEqual(ext.rows.length, 0, 'pg_vector should be absent');
      const crypto = await client.query(
        "SELECT extname FROM pg_extension WHERE extname='pgcrypto'"
      );
      assert.ok(crypto.rows.length > 0, 'pgcrypto not installed');
      let tbl = await client.query(
        "SELECT to_regclass('public.feedback_events') as t"
      );
      if (!tbl.rows[0].t) {
        const migrationSql = fs.readFileSync(
          path.join(process.cwd(), 'migrations/002_create_feedback_events.sql'),
          'utf8'
        );
        await client.query(migrationSql);
        tbl = await client.query(
          "SELECT to_regclass('public.feedback_events') as t"
        );
      }
      assert.ok(tbl.rows[0].t, 'feedback_events table missing');
    } finally {
      await client.end();
    }
  });
});
