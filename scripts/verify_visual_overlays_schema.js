#!/usr/bin/env node
/**
 * Verification script for visual_overlays table schema
 * Checks current dimension of embedding column and presence of legacy columns
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), 'data', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
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
  password: process.env.POSTGRES_PASSWORD || process.env.PAPERLESS_DBPASS,
};

async function verify() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log(`\n[Verify] Connected to ${config.database}@${config.host}\n`);

    // Check pgvector extension
    const extRes = await client.query("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'");
    if (extRes.rows.length) {
      console.log(`✓ pgvector extension: v${extRes.rows[0].extversion}`);
    } else {
      console.log('✗ pgvector extension: NOT FOUND');
      process.exit(1);
    }

    // Check visual_overlays table exists
    const tblRes = await client.query("SELECT to_regclass('public.visual_overlays') as t");
    if (!tblRes.rows[0].t) {
      console.log('✗ visual_overlays table: NOT FOUND');
      process.exit(1);
    }
    console.log('✓ visual_overlays table: EXISTS\n');

    // Get all columns with vector type
    const colRes = await client.query(`
      SELECT
        column_name,
        udt_name,
        CASE
          WHEN udt_name = 'vector' THEN (
            SELECT atttypmod
            FROM pg_attribute
            WHERE attrelid = 'visual_overlays'::regclass
            AND attname = column_name
          )
          ELSE NULL
        END as vector_dimension
      FROM information_schema.columns
      WHERE table_name = 'visual_overlays'
      AND (column_name LIKE '%embedding%' OR udt_name = 'vector')
      ORDER BY ordinal_position
    `);

    console.log('=== Embedding Columns ===');
    const findings = {};
    for (const row of colRes.rows) {
      const dim = row.vector_dimension ? row.vector_dimension : 'N/A';
      console.log(`  ${row.column_name}: ${row.udt_name}${row.udt_name === 'vector' ? `(${dim})` : ''}`);
      findings[row.column_name] = { type: row.udt_name, dimension: dim };
    }
    console.log('');

    // Check indexes
    const idxRes = await client.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'visual_overlays'
      AND indexname LIKE '%embedding%'
      ORDER BY indexname
    `);

    console.log('=== Embedding Indexes ===');
    for (const row of idxRes.rows) {
      console.log(`  ${row.indexname}`);
      console.log(`    ${row.indexdef}\n`);
    }

    // Analysis and recommendations
    console.log('\n=== Analysis ===');

    if (findings.embedding && findings.embedding.type === 'vector') {
      const dim = findings.embedding.dimension;
      if (dim === 320) {
        console.log('✓ CORRECT: embedding is vector(320) - matches ColQwen3 spec');
      } else if (dim === 768) {
        console.log('✗ INCORRECT: embedding is vector(768) - should be 320 for ColQwen3');
        console.log('\n  ACTION REQUIRED: Run migration to convert to 320-d');
        console.log('  Command: node migrations/04_change_embeddings_to_320.js');
      } else {
        console.log(`⚠ UNEXPECTED: embedding is vector(${dim})`);
      }
    } else if (findings.embedding && findings.embedding.type !== 'vector') {
      console.log(`⚠ UNEXPECTED: embedding exists but is type ${findings.embedding.type}, not vector`);
    } else {
      console.log('✗ MISSING: embedding column not found');
    }

    if (findings.embedding_vector) {
      console.log(`\n⚠ FOUND: embedding_vector column (${findings.embedding_vector.type})`);
      console.log('  This is a legacy column from old migrations (01-03).');
      console.log('  Current code only uses "embedding" column.');
      console.log('  Consider dropping after verifying migration 04 is complete.');
    }

    if (findings.embedding_legacy_backup || findings.embedding_vector_legacy_backup) {
      console.log('\n✓ FOUND: Legacy backup columns from migration 04');
      if (findings.embedding_legacy_backup) {
        console.log(`  - embedding_legacy_backup (${findings.embedding_legacy_backup.type})`);
      }
      if (findings.embedding_vector_legacy_backup) {
        console.log(`  - embedding_vector_legacy_backup (${findings.embedding_vector_legacy_backup.type})`);
      }
      console.log('  These can be dropped after verifying new 320-d embeddings work correctly.');
    }

    console.log('\n');
    process.exit(0);

  } catch (err) {
    console.error('✗ Verification failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verify();
