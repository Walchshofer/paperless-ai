/*
 Migration: Move visual_overlays embeddings to 320-d vectors (ColQwen3)
 - Renames any existing `embedding` or `embedding_vector` columns to *_legacy_backup
 - Adds new `embedding` and `embedding_vector` columns with type vector(320)
 - Drops old vector indexes and creates new HNSW + IVFFLAT indexes on the new 320-d column
 - This migration intentionally does NOT attempt to cast or shrink existing vectors; preserve backups and re-ingest with the new model instead.

 Usage: node migrations/04_change_embeddings_to_320.js [--dry-run]
*/

const { Pool } = require('pg');
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

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

console.log('[Migration] Start: change visual_overlays embedding to vector(320)');
if (DRY_RUN) console.log('[Migration] ⚠️  DRY RUN MODE: No changes will be committed.');

const pool = new Pool(config);

async function migrate() {
  const client = await pool.connect();
  try {
    if (!DRY_RUN) await client.query('BEGIN');

    console.log('[Migration] Dropping old embedding indexes (if present)...');
    await client.query(`DROP INDEX IF EXISTS idx_visual_overlays_embedding_ivfflat`);
    await client.query(`DROP INDEX IF EXISTS idx_visual_overlays_embedding`);
    await client.query(`DROP INDEX IF EXISTS idx_visual_overlays_embedding_vector`);

    console.log('[Migration] Renaming legacy embedding columns (if present)...');
    // Safe renames - do not error if columns do not exist
    try {
      await client.query(`ALTER TABLE visual_overlays RENAME COLUMN embedding TO embedding_legacy_backup`);
      console.log('[Migration] Renamed `embedding` to `embedding_legacy_backup`');
    } catch (e) {
      // ignore
    }

    try {
      await client.query(`ALTER TABLE visual_overlays RENAME COLUMN embedding_vector TO embedding_vector_legacy_backup`);
      console.log('[Migration] Renamed `embedding_vector` to `embedding_vector_legacy_backup`');
    } catch (e) {
      // ignore
    }

    console.log('[Migration] Creating new 320-d vector columns...');
    await client.query(`ALTER TABLE visual_overlays ADD COLUMN IF NOT EXISTS embedding vector(320) DEFAULT NULL`);
    await client.query(`ALTER TABLE visual_overlays ADD COLUMN IF NOT EXISTS embedding_vector vector(320) DEFAULT NULL`);

    console.log('[Migration] Creating new indexes for 320-d embeddings...');
    // HNSW for low-latency similarity
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visual_overlays_embedding ON visual_overlays USING hnsw (embedding vector_cosine_ops)`);
    // IVFFLAT for large-scale batch retrieval (lists tuning may be needed)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visual_overlays_embedding_ivfflat ON visual_overlays USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`);

    if (!DRY_RUN) await client.query('COMMIT');

    console.log('[Migration] Done. Note: Existing embeddings are preserved as backups (embedding_legacy_backup, embedding_vector_legacy_backup).');
    console.log('[Migration] Next steps: Re-run index population with the new model and re-ingest documents with `scripts/migrate_visual_rag_colqwen3.js`. After indexes are built, re-run `node scripts/check_pgvector.js` to validate the schema.');

  } catch (err) {
    if (!DRY_RUN) await client.query('ROLLBACK');
    console.error('[Migration] Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
