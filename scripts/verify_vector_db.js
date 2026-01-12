/**
 * Verification Script: Vector Database Functionality (Qdrant)
 * Usage: node scripts/verify_vector_db.js
 *
 * Validates:
 * 1. Connection to Qdrant
 * 2. Upsert of a test vector
 * 3. Similarity search
 * 4. Cleanup
 */
const { qdrantAdapter } = require('../services/visual-rag/QdrantAdapter');

async function verify() {
    console.log('[Verify] Initializing Qdrant adapter...');
    await qdrantAdapter.initialize();

    const docId = Date.now();
    const pointId = `verify_${docId}`;
    const embedding = new Array(320).fill(0);
    embedding[0] = 1;

    try {
        console.log('[Verify] Upserting test vector...');
        await qdrantAdapter.upsertVisualOverlays([
            {
                id: pointId,
                embedding,
                docId,
                payload: {
                    doc_id: docId,
                    correspondent_id: null,
                    tag_ids: []
                }
            }
        ]);

        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('[Verify] Searching for test vector...');
        const results = await qdrantAdapter.searchVisualOverlays(embedding, {
            limit: 5
        });

        const found = results.find(row => row.id === pointId);
        if (!found) {
            console.error('❌ FAILURE: Test vector not found in Qdrant search');
            process.exit(1);
        }

        console.log('✅ SUCCESS: Vector search returned test point');

        console.log('[Verify] Cleaning up...');
        await qdrantAdapter.deleteVisualOverlaysByDocId(docId);
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        process.exit(1);
    }
}

verify();
