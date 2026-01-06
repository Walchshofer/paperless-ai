const assert = require('assert');
const { Client } = require('pg');

describe('DB Schema Integration (staging)', function() {
  it('should have feedback_events table and extensions', async function() {
    const url = process.env.POSTGRES_URL;
    if (!url) this.skip();
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const ext = await client.query("SELECT extversion FROM pg_extension WHERE extname='vector'");
      assert.ok(ext.rows.length > 0, 'pg_vector not installed');
      const tbl = await client.query("SELECT to_regclass('public.feedback_events') as t");
      assert.ok(tbl.rows[0].t, 'feedback_events table missing');
    } finally {
      await client.end();
    }
  });
});