#!/usr/bin/env node
/**
 * Simple DB schema checker for CI. Uses POSTGRES_URL env var.
 * Exits with non-zero code if checks fail.
 */
const { Client } = require('pg');

async function main() {
  const url = process.env.POSTGRES_URL || (process.env.POSTGRES_HOST ?
    `postgres://${process.env.POSTGRES_USER}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || '')}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'paperless'}` : null);

  if (!url) {
    console.warn('POSTGRES_URL or POSTGRES_HOST not set; skipping DB checks.');
    process.exit(0);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const doMigrate = process.argv.includes('--migrate');

  try {
    // If requested, apply migration SQL
    if (doMigrate) {
      const path = require('path');
      const fs = require('fs');
      const sqlPath = path.join(__dirname, '..', 'migrations', '002_create_feedback_events.sql');
      if (!fs.existsSync(sqlPath)) {
        console.error('Migration file not found:', sqlPath);
        process.exit(2);
      }
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log('Applying migration: 002_create_feedback_events.sql');
      try {
        await client.query(sql);
        console.log('Migration applied successfully');
      } catch (mErr) {
        console.error('Migration failed:', mErr.message);
        process.exit(3);
      }
    }

    // Check feedback_events table
    const tbl = await client.query("SELECT to_regclass('public.feedback_events') as t");
    if (!tbl.rows[0].t) {
      console.error('feedback_events table not found');
      process.exit(4);
    }
    console.log('feedback_events exists');

    // Check metadata columns and ensure vector columns are absent
    const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='visual_overlays'");
    const found = cols.rows.map(r => r.column_name);
    if (!found.includes('bbox')) {
      console.warn('visual_overlays.bbox column not found');
    } else {
      console.log('visual_overlays.bbox: present');
    }

    const vectorColumns = ['embedding', 'embedding_vector', 'vector_320'];
    const presentVectors = vectorColumns.filter(col => found.includes(col));
    if (presentVectors.length > 0) {
      console.error('Vector columns found in visual_overlays:', presentVectors);
      process.exit(6);
    }

    console.log('DB schema checks completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('DB check failed:', err.message);
    process.exit(5);
  } finally {
    await client.end();
  }
}

main();
