/**
 * Migration: Convert JSONB embeddings to vector(768)
 * Usage: node migrations/02_migrate_embeddings.js [--dry-run] [--batch-size=500]
 *
 * Behavior:
 *  - Loads env from data/.env if present
 *  - Connects using PG env variables; fallback defaults provided
 *  - Creates a timestamped backup table with id, embedding
 *  - Processes rows in batches where embedding IS NOT NULL and embedding_vector IS NULL
 *  - Validates jsonb_typeof(embedding) = 'array' and jsonb_array_length(embedding) = 768 and numeric elements
 *  - Sets embedding_vector using parameterized UPDATEs with $1::vector
 *  - Supports --dry-run to only report counts
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
const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 500;

console.log(`[Migration] Starting... Host: ${config.host}, DB: ${config.database}`);
if (DRY_RUN) console.log('[Migration] ⚠️  DRY RUN MODE: No changes will be committed.');

const pool = new Pool(config);

async function migrate() {
    const client = await pool.connect();
    try {
        // 1. Create backup table
        const backupTableName = `visual_overlays_embedding_backup_${new Date().toISOString().slice(0,10).replace(/-/g,'')}`;
        if (!DRY_RUN) {
            await client.query(`
                CREATE TABLE IF NOT EXISTS ${backupTableName} (
                    id BIGINT PRIMARY KEY,
                    embedding JSONB,
                    backed_up_at TIMESTAMP DEFAULT NOW()
                )
            `);
            console.log(`[Migration] Backup table ensured: ${backupTableName}`);
        } else {
            console.log('[Migration] Dry-run: skipping backup table creation');
        }

        // 2. Processing Loop
        let processed = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        let hasMore = true;

        while (hasMore) {
            const res = await client.query(`
                SELECT id, embedding 
                FROM visual_overlays 
                WHERE embedding IS NOT NULL 
                  AND embedding_vector IS NULL 
                LIMIT $1
            `, [BATCH_SIZE]);

            if (res.rows.length === 0) {
                hasMore = false;
                break;
            }

            const updates = [];
            const backups = [];

            for (const row of res.rows) {
                let isValid = false;
                let vectorStr = null;

                // Validate: row.embedding is likely parsed by pg driver as object/array already
                const emb = row.embedding;
                if (Array.isArray(emb) && emb.length === 768) {
                    if (emb.every(n => typeof n === 'number' && Number.isFinite(n))) {
                        isValid = true;
                        vectorStr = JSON.stringify(emb);
                    }
                }

                if (isValid) {
                    updates.push({ id: row.id, vec: vectorStr });
                    backups.push({ id: row.id, original: JSON.stringify(row.embedding) });
                } else {
                    skipped++;
                    console.warn(`[Skip] ID ${row.id}: Invalid embedding format or length.`);
                }
            }

            if (updates.length === 0 && res.rows.length > 0) {
                console.error('[Migration] Batch contained only invalid rows. Proceeding to next batch to avoid infinite loop.');
                // advance processed and continue to next batch (we select different rows next iterations)
                processed += res.rows.length;
                continue;
            }

            if (!DRY_RUN && updates.length > 0) {
                try {
                    await client.query('BEGIN');

                    for (const b of backups) {
                        await client.query(`
                            INSERT INTO ${backupTableName} (id, embedding)
                            VALUES ($1, $2)
                            ON CONFLICT (id) DO NOTHING
                        `, [b.id, b.original]);
                    }

                    for (const u of updates) {
                        await client.query(`
                            UPDATE visual_overlays
                            SET embedding_vector = $1::vector
                            WHERE id = $2
                        `, [u.vec, u.id]);
                    }

                    await client.query('COMMIT');
                    updated += updates.length;
                } catch (err) {
                    await client.query('ROLLBACK');
                    console.error('[Error] Batch failed:', err.message);
                    errors += updates.length;
                }
            } else if (DRY_RUN) {
                updated += updates.length;
            }

            processed += res.rows.length;
            process.stdout.write(
                `\r[Migration] Processed: ${processed} | Updated: ${updated} | Skipped: ${skipped} | Errors: ${errors}`
            );
        }

        console.log('\n[Migration] Data conversion complete.');

        // 3. Create HNSW index AFTER population (recommended)
        if (!DRY_RUN) {
            console.log('[Migration] Creating HNSW index (this may take a moment)...');
            const start = Date.now();
            try {
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_visual_overlays_embedding_vector
                    ON visual_overlays USING hnsw (embedding_vector vector_cosine_ops);
                `);
                console.log(`[Migration] Index created in ${(Date.now() - start) / 1000}s.`);
            } catch (err) {
                console.error('[Migration] Index creation failed:', err.message);
            }
        } else {
            console.log('[Migration] Dry-run: skipping index creation');
        }

        console.log('\n[Migration] Summary:');
        console.log(`Converted: ${updated}`);
        console.log(`Skipped (invalid): ${skipped}`);
        console.log(`Errors: ${errors}`);

    } catch (e) {
        console.error('\n[Migration] Critical Error:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
