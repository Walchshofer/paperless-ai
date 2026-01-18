#!/usr/bin/env node
/**
 * Check Qdrant Collections
 *
 * Verifies that Qdrant is running and collections are properly configured.
 * Used for CI verification and health checks.
 *
 * Usage:
 *   node scripts/check-qdrant-collections.js
 *
 * Environment:
 *   QDRANT_HOST - Qdrant host (default: localhost)
 *   QDRANT_PORT - Qdrant port (default: 6333)
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Checks failed
 */

const { QdrantAdapter, COLLECTIONS } = require('../services/visual-rag-client/QdrantAdapter');

async function main() {
    console.log('='.repeat(60));
    console.log('Qdrant Collection Verification');
    console.log('='.repeat(60));
    console.log();

    const host = process.env.QDRANT_HOST || 'localhost';
    const port = process.env.QDRANT_PORT || 6333;

    console.log(`Target: ${host}:${port}`);
    console.log();

    try {
        const adapter = new QdrantAdapter({ host, port: parseInt(port, 10) });

        // Health check
        console.log('1. Health Check');
        console.log('-'.repeat(40));
        const health = await adapter.healthCheck();

        if (!health.healthy) {
            console.error(`   FAILED: ${health.error}`);
            process.exit(1);
        }
        console.log('   Status: HEALTHY');
        console.log();

        // Collection verification
        console.log('2. Collection Verification');
        console.log('-'.repeat(40));

        let allPassed = true;
        const expectedCollections = [
            { name: 'document_embeddings', size: 384, distance: 'Cosine' },
            { name: 'visual_overlays', size: 320, distance: 'Cosine' },
            { name: 'visual_pages', size: 320, distance: 'Dot' }
        ];

        for (const expected of expectedCollections) {
            const info = health.collections[expected.name];

            if (!info) {
                console.log(`   ${expected.name}: NOT FOUND`);
                allPassed = false;
                continue;
            }

            if (!info.exists) {
                console.log(`   ${expected.name}: NOT EXISTS`);
                allPassed = false;
                continue;
            }

            const sizeMatch = info.vectorSize === expected.size;
            const distanceMatch = info.distance === expected.distance;

            if (sizeMatch && distanceMatch) {
                console.log(`   ${expected.name}: OK (${expected.size}D, ${expected.distance}, ${info.pointCount || 0} points)`);
            } else {
                console.log(`   ${expected.name}: MISMATCH`);
                console.log(`      Expected: ${expected.size}D, ${expected.distance}`);
                console.log(`      Actual: ${info.vectorSize}D, ${info.distance}`);
                allPassed = false;
            }
        }

        console.log();

        // Summary
        console.log('3. Summary');
        console.log('-'.repeat(40));

        if (allPassed) {
            console.log('   All checks PASSED');
            console.log();
            console.log('='.repeat(60));
            process.exit(0);
        } else {
            console.log('   Some checks FAILED');
            console.log();
            console.log('   To initialize collections, run:');
            console.log('   node -e "require(\'./services/visual-rag-client/QdrantAdapter\').qdrantAdapter.initialize()"');
            console.log();
            console.log('='.repeat(60));
            process.exit(1);
        }
    } catch (error) {
        console.error();
        console.error('ERROR:', error.message);
        console.error();
        console.error('Is Qdrant running? Start with:');
        console.error('  docker-compose up qdrant');
        console.error();
        process.exit(1);
    }
}

main();
