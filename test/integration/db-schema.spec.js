const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

describe('DB Schema Integration (staging)', function() {
  it('should have feedback_events table and extensions', async function() {
    const url = process.env.POSTGRES_URL;
    const host = process.env.POSTGRES_HOST;
    const port = process.env.POSTGRES_PORT || '5432';
    const database = process.env.POSTGRES_DB;
    const user = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;
    if (!url && (!host || !database || !user || !password)) this.skip();
    const client = url ? new Client({ connectionString: url }) : new Client({
      host,
      port,
      database,
      user,
      password
    });
    await client.connect();
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
