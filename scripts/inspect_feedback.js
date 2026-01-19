// Temporary script to inspect recent feedback_events rows
const { Client } = require('pg');
(async () => {
  const client = new Client({
    user: process.env.POSTGRES_USER || process.env.PAPERLESS_DBUSER || 'elfman',
    host: process.env.POSTGRES_HOST || process.env.PAPERLESS_DBHOST || 'localhost',
    database: process.env.POSTGRES_DB || process.env.PAPERLESS_DBNAME || 'paperless',
    password: process.env.POSTGRES_PASSWORD || process.env.PAPERLESS_DBPASS || 'P2tr3ck!1976',
    port: process.env.POSTGRES_PORT || process.env.PAPERLESS_DBPORT || 5432
  });
  try {
    await client.connect();
    const res = await client.query(`SELECT id, context->>'request_id' AS request_id, context, created_at FROM feedback_events ORDER BY created_at DESC LIMIT 20;`);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error('DB query failed:', e.message);
    process.exit(1);
  } finally {
    try { await client.end(); } catch (e) {}
  }
})();
