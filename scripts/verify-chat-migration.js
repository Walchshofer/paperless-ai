const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function _requireEnvOrExit(key) {
  const v = process.env[key];
  if (v && v !== '') return v;
  console.error(`Missing required env: ${key}`);
  process.exit(1);
}

(async () => {
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
  const database = process.env.POSTGRES_DB || 'paperless_test';
  const user = process.env.POSTGRES_USER || 'elfman';
  const password = process.env.POSTGRES_PASSWORD || 'password';

  const pool = new Pool({ host, port, database, user, password });
  const migrationPath = path.join(process.cwd(), 'migrations', '006_create_chat_schema.sql');
  const rollbackPath = path.join(process.cwd(), 'migrations', '006_rollback_chat_schema.sql');

  try {
    const client = await pool.connect();
    console.log('Connected to Postgres for chat migration verification');

    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Running chat migration...');
    await client.query(migrationSql);

    const r1 = await client.query("SELECT to_regclass('public.chat_sessions') as t");
    const r2 = await client.query("SELECT to_regclass('public.chat_messages') as t");

    if (!r1.rows[0].t || !r2.rows[0].t) {
      console.error('Chat tables not created as expected');
      process.exit(2);
    }
    console.log('Chat tables created');

    // Run rollback
    const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');
    console.log('Running chat rollback...');
    await client.query(rollbackSql);

    const rr1 = await client.query("SELECT to_regclass('public.chat_sessions') as t");
    const rr2 = await client.query("SELECT to_regclass('public.chat_messages') as t");

    if (rr1.rows[0].t || rr2.rows[0].t) {
      console.error('Chat tables not dropped by rollback');
      process.exit(3);
    }

    console.log('Rollback successful — chat tables removed');
    client.release();
    await pool.end();
    console.log('Chat migration verification passed');
    process.exit(0);
  } catch (error) {
    console.error('Migration verification failed:', error.message);
    try { await pool.end(); } catch (e) {}
    process.exit(5);
  }
})();
