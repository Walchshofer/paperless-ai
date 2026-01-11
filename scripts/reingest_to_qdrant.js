#!/usr/bin/env node
/**
 * Re-ingest Documents to Qdrant
 *
 * Batch re-ingestion script for migrating from pgVector to Qdrant.
 * Processes documents from paperless-ngx and creates embeddings in Qdrant.
 *
 * Usage:
 *   node scripts/reingest_to_qdrant.js [options]
 *
 * Options:
 *   --dry-run       Show what would be done without making changes
 *   --batch-size N  Process N documents per batch (default: 10)
 *   --doc-ids       Comma-separated list of doc IDs to process
 *   --verify        Verify ingested documents after processing
 *   --help          Show this help message
 *
 * Environment:
 *   QDRANT_HOST      - Qdrant host (default: localhost)
 *   QDRANT_PORT      - Qdrant port (default: 6333)
 *   PAPERLESS_URL    - Paperless-ngx API URL
 *   PAPERLESS_TOKEN  - Paperless-ngx API token
 */

const { qdrantAdapter } = require('../services/visual-rag/QdrantAdapter');
const logger = require('../services/logger');

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: false,
        batchSize: 10,
        docIds: null,
        verify: false,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--dry-run':
                options.dryRun = true;
                break;
            case '--batch-size':
                options.batchSize = parseInt(args[++i], 10);
                break;
            case '--doc-ids':
                options.docIds = args[++i].split(',').map(id => parseInt(id, 10));
                break;
            case '--verify':
                options.verify = true;
                break;
            case '--help':
                options.help = true;
                break;
        }
    }

    return options;
}

function showHelp() {
    console.log(`
Re-ingest Documents to Qdrant

Usage:
  node scripts/reingest_to_qdrant.js [options]

Options:
  --dry-run       Show what would be done without making changes
  --batch-size N  Process N documents per batch (default: 10)
  --doc-ids       Comma-separated list of doc IDs to process
  --verify        Verify ingested documents after processing
  --help          Show this help message

Examples:
  # Dry run to see what would be processed
  node scripts/reingest_to_qdrant.js --dry-run

  # Process specific documents
  node scripts/reingest_to_qdrant.js --doc-ids 1,2,3 --verify

  # Full migration with verification
  node scripts/reingest_to_qdrant.js --batch-size 20 --verify
`);
}

async function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        process.exit(0);
    }

    console.log('='.repeat(60));
    console.log('Qdrant Re-ingestion Script');
    console.log('='.repeat(60));
    console.log();
    console.log('Options:');
    console.log(`  Dry run: ${options.dryRun}`);
    console.log(`  Batch size: ${options.batchSize}`);
    console.log(`  Doc IDs: ${options.docIds ? options.docIds.join(', ') : 'all'}`);
    console.log(`  Verify: ${options.verify}`);
    console.log();

    try {
        // Initialize Qdrant adapter
        console.log('Initializing Qdrant...');
        await qdrantAdapter.initialize();
        console.log('Qdrant initialized successfully.');
        console.log();

        // Health check
        const health = await qdrantAdapter.healthCheck();
        if (!health.healthy) {
            console.error('Qdrant is not healthy:', health.error);
            process.exit(1);
        }

        console.log('Collection status:');
        for (const [name, info] of Object.entries(health.collections)) {
            console.log(`  ${name}: ${info.exists ? 'exists' : 'missing'} (${info.pointCount || 0} points)`);
        }
        console.log();

        if (options.dryRun) {
            console.log('[DRY RUN] Would process documents here.');
            console.log();
            console.log('To perform actual migration, run without --dry-run');
            process.exit(0);
        }

        // TODO: Implement actual document processing
        // This would:
        // 1. Fetch documents from Paperless-ngx API
        // 2. Generate embeddings using the appropriate models
        // 3. Upsert to Qdrant collections
        // 4. Optionally verify the results

        console.log('Document processing not yet implemented.');
        console.log('This script will be completed when integrating with:');
        console.log('  - Paperless-ngx API client');
        console.log('  - Embedding model services');
        console.log('  - Visual RAG sidecar');
        console.log();

        if (options.verify) {
            console.log('Verification:');
            const finalHealth = await qdrantAdapter.healthCheck();
            for (const [name, info] of Object.entries(finalHealth.collections)) {
                console.log(`  ${name}: ${info.pointCount || 0} points`);
            }
        }

        console.log();
        console.log('='.repeat(60));
        console.log('Re-ingestion complete');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Error during re-ingestion:', error.message);
        process.exit(1);
    }
}

main();
