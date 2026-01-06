#!/usr/bin/env node
/**
 * Simple DB schema checker for CI. Uses POSTGRES_URL env var.
 * Exits with non-zero code if checks fail.
 */
const { Client } = require('pg');

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.warn('POSTGRES_URL not set; skipping DB checks.');
    process.exit(0);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const res = await client.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'");
    if (!res.rows.length) {
      console.error('pg_vector extension not installed');
      process.exit(2);
    }
    console.log('pg_vector:', res.rows[0].extversion);

    const tbl = await client.query("SELECT to_regclass('public.feedback_events') as t");
    if (!tbl.rows[0].t) {
      console.error('feedback_events table not found');
      process.exit(3);
    }
    console.log('feedback_events exists');

    const emb = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='visual_overlays' and column_name='embedding'");
    if (!emb.rows.length) {
      console.warn('visual_overlays.embedding column not found (optional for some deployments)');
    } else {
      console.log('visual_overlays.embedding:', emb.rows[0].data_type);
    }

    console.log('DB schema checks completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('DB check failed:', err.message);
    process.exit(4);
  } finally {
    await client.end();
  }
}

main();