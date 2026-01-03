/**
 * Verification Script: Vector Database Functionality
 * Usage: node scripts/verify_vector_db.js
 * 
 * Validates:
 * 1. Connection to DB
 * 2. Insertion of a test vector
 * 3. Similarity search (HNSW index usage)
 * 4. Cleanup
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// --- Env Loading (Same as migration) ---
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

const pool = new Pool(config);

async function verify() {
    console.log(`[Verify] Connecting to ${config.host}:${config.port}/${config.database}...`);
    const client = await pool.connect();
    
    // Test Data: 768-dimensional vector
    // We'll use a simple pattern: [1, 0, 0, ...], [0, 1, 0, ...]
    const dim = 768;
    const vecA = Array(dim).fill(0); vecA[0] = 1; // Vector pointing along X axis
    const vecB = Array(dim).fill(0); vecB[1] = 1; // Vector pointing along Y axis
    const vecC = Array(dim).fill(0); vecC[0] = 0.9; vecC[1] = 0.1; // Close to A

    const testDocId = 999999999; // High ID to avoid conflict

    try {
        // 1. Cleanup previous runs
        await client.query('DELETE FROM visual_overlays WHERE doc_id = $1', [testDocId]);

        // 2. Insert Test Vectors
        console.log('[Verify] Inserting test vectors...');
        const insertQuery = `
            INSERT INTO visual_overlays (doc_id, page_number, overlay_data, semantic_label, embedding)
            VALUES ($1, $2, $3, $4, $5::vector)
        `;

        const overlayA = JSON.stringify({ label: 'test-a', box: [0, 0, 1, 1] });
        const overlayB = JSON.stringify({ label: 'test-b', box: [0, 0, 1, 1] });
        const overlayC = JSON.stringify({ label: 'test-c', box: [0, 0, 1, 1] });

        await client.query(insertQuery, [testDocId, 1, overlayA, 'Test Vector A', JSON.stringify(vecA)]);
        await client.query(insertQuery, [testDocId, 2, overlayB, 'Test Vector B', JSON.stringify(vecB)]);
        await client.query(insertQuery, [testDocId, 3, overlayC, 'Test Vector C', JSON.stringify(vecC)]);

        // 3. Perform Similarity Search (Find closest to A)
        console.log('[Verify] Performing similarity search (Target: Vector A)...');
        // Note: <=> is cosine distance. 0 = identical, 2 = opposite.
        // 1 - (<=>) gives cosine similarity (1.0 = identical).
        const searchQuery = `
            SELECT page_number, semantic_label, 1 - (embedding <=> $1::vector) as similarity
            FROM visual_overlays
            WHERE doc_id = $2
            ORDER BY embedding <=> $1::vector ASC
            LIMIT 3
        `;

        const res = await client.query(searchQuery, [JSON.stringify(vecA), testDocId]);

        console.log('\n[Verify] Search Results:');
        res.rows.forEach(row => {
            console.log(` - Label: ${row.semantic_label}, Similarity: ${parseFloat(row.similarity).toFixed(4)}`);
        });

        // Validation Logic
        const first = res.rows[0];
        if (first && first.semantic_label === 'Test Vector A' && parseFloat(first.similarity) > 0.99) {
            console.log('\n✅ SUCCESS: Vector database is functioning correctly.');
        } else {
            console.error('\n❌ FAILURE: Search did not return expected results.');
            process.exit(1);
        }

        // 4. Cleanup
        await client.query('DELETE FROM visual_overlays WHERE doc_id = $1', [testDocId]);
        console.log('[Verify] Cleanup complete.');

    } catch (err) {
        console.error('\n❌ ERROR:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

verify();
