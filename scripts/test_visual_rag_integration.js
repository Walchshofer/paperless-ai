/**
 * Integration Test: Visual RAG Repository Flow
 * Verifies:
 * 1. Database connection via Repository class
 * 2. Vector insertion (verifies $5::vector cast)
 * 3. Vector similarity search (verifies <=> operator and casting)
 */

const path = require('path');
const fs = require('fs');

// 1. Load Environment Variables
const envPath = path.join(__dirname, '../data/.env');
if (fs.existsSync(envPath)) {
    console.log(`[Test] Loading .env from ${envPath}`);
    require('dotenv').config({ path: envPath });
} else {
    console.warn('[Test] No .env file found in ../data/.env, relying on process.env');
}

// 2. Load Repository
let visualOverlayRepository;
try {
    const repo = require('../services/visual-rag-client/VisualOverlayRepository');
    visualOverlayRepository = repo.visualOverlayRepository;
} catch (err) {
    console.error('[Test] Failed to load VisualOverlayRepository. Ensure dependencies are installed.');
    console.error(err);
    process.exit(1);
}

async function runTest() {
    const DOC_ID = 999999998; // Test ID
    const PAGE_NUM = 1;
    
    try {
        console.log('[Test] Checking repository availability...');
        const isAvailable = await visualOverlayRepository.isAvailable();
        if (!isAvailable) {
            throw new Error('Repository is not available (DB connection failed)');
        }
        console.log('[Test] Repository is available.');

        // Cleanup start
        await visualOverlayRepository.deleteByDocId(DOC_ID);

        // 3. Insert Test Data
        console.log('[Test] Inserting overlay with vector embedding...');
        const embedding = Array(320).fill(0);
        embedding[0] = 1.0; // Unit vector on dimension 0

        const overlay = {
            label: 'integration_test',
            box: [0, 0, 100, 100],
            confidence: 0.99
        };

        await visualOverlayRepository.saveOverlay(
            DOC_ID,
            PAGE_NUM,
            overlay,
            'test_label',
            embedding
        );
        console.log('[Test] Insert successful.');

        // 4. Search
        console.log('[Test] Searching by embedding...');
        const searchEmbedding = Array(320).fill(0);
        searchEmbedding[0] = 1.0; // Exact match

        const results = await visualOverlayRepository.searchByEmbedding(searchEmbedding, 5);
        
        console.log(`[Test] Found ${results.length} results.`);
        
        const match = results.find(r => r.docId === DOC_ID);
        if (match) {
            console.log(`[Test] Found inserted document. Similarity: ${match.similarity}`);
            if (match.similarity > 0.99) {
                console.log('[Test] ✅ SUCCESS: Vector integration verified.');
            } else {
                console.error('[Test] ❌ FAILURE: Similarity score too low.');
                process.exit(1);
            }
        } else {
            console.error('[Test] ❌ FAILURE: Inserted document not found in search results.');
            process.exit(1);
        }

    } catch (err) {
        console.error('[Test] ❌ ERROR:', err.message);
        process.exit(1);
    } finally {
        // Cleanup
        if (visualOverlayRepository) {
            await visualOverlayRepository.deleteByDocId(DOC_ID);
            // No close method exposed; repository uses pool which will be closed on process exit
        }
    }
}

runTest();
