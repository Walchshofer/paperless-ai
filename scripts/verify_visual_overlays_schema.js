#!/usr/bin/env node
/**
 * Verification script for visual_overlays table schema (metadata-only).
 * Ensures vector columns are absent after Qdrant migration.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), 'docker-compose.env'),
    path.join(process.cwd(), '.env')
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const match = line.match(/^([^#=][^=]*)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
  }
}
loadEnv();

const config = {
  host: process.env.POSTGRES_HOST || process.env.PAPERLESS_DBHOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || process.env.PAPERLESS_DBPORT || '5432', 10),
  database: process.env.POSTGRES_DB || process.env.PAPERLESS_DBNAME || 'paperless',
  user: process.env.POSTGRES_USER || process.env.PAPERLESS_DBUSER || 'elfman',
  password: process.env.POSTGRES_PASSWORD || process.env.PAPERLESS_DBPASS
};

async function verify() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log(`\n[Verify] Connected to ${config.database}@${config.host}\n`);

    const tblRes = await client.query(
      "SELECT to_regclass('public.visual_overlays') as t"
    );
    if (!tblRes.rows[0].t) {
      console.log('✗ visual_overlays table: NOT FOUND');
      process.exit(1);
    }
    console.log('✓ visual_overlays table: EXISTS\n');

    const colRes = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='visual_overlays'"
    );
    const columns = colRes.rows.map(row => row.column_name);
    const vectorColumns = [
      'embedding',
      'embedding_vector',
      'embedding_jsonb_backup',
      'embedding_legacy_backup',
      'embedding_vector_legacy_backup',
      'vector_320'
    ];
    const present = vectorColumns.filter(col => columns.includes(col));

    if (present.length > 0) {
      console.log('✗ Vector columns detected:', present.join(', '));
      process.exit(2);
    }

    console.log('✓ No vector columns present (metadata-only)');
    process.exit(0);
  } catch (err) {
    console.error('✗ Verification failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verify();
