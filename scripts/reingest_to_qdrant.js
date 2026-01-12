#!/usr/bin/env node
/**
 * Re-ingest Documents to Qdrant
 *
 * Batch re-ingestion script for migrating from pgVector to Qdrant.
 * Processes documents from Paperless-ngx and creates embeddings in Qdrant.
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
 *   PAPERLESS_API_URL    - Paperless-ngx API URL
 *   PAPERLESS_API_TOKEN  - Paperless-ngx API token
 *   OLLAMA_API_URL   - Ollama API base URL (default: http://localhost:11434)
 *   EMBEDDING_MODEL  - Text embedding model (default: nomic-embed-text-v1.5)
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { qdrantAdapter } = require('../services/visual-rag/QdrantAdapter');
const { pdfRenderer } = require('../services/visual-rag/PDFRenderer');
const { visualSearchClient } = require('../services/visual-rag/VisualSearchClient');
const paperlessService = require('../services/paperlessService');

const DEFAULT_BATCH_SIZE = 10;
const MAX_VISION_PAGES = parseInt(process.env.MAX_VISION_PAGES || '5', 10);

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: false,
        batchSize: DEFAULT_BATCH_SIZE,
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

function resolveOllamaUrl() {
    return process.env.OLLAMA_API_URL ||
        process.env.OLLAMA_HOST ||
        'http://localhost:11434';
}

function resolveEmbeddingModel() {
    return process.env.EMBEDDING_MODEL ||
        process.env.OLLAMA_EMBEDDING_MODEL ||
        'nomic-embed-text-v1.5';
}

function extractCorrespondentId(doc) {
    const value = doc.correspondent_id || doc.correspondent;
    if (value && typeof value === 'object') {
        return value.id || null;
    }
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
}

function extractTagIds(doc) {
    const tags = doc.tag_ids || doc.tags || [];
    const values = Array.isArray(tags) ? tags : [tags];
    return values
        .map(tag => (tag && typeof tag === 'object') ? tag.id : tag)
        .map(tag => {
            const num = Number(tag);
            return Number.isNaN(num) ? null : num;
        })
        .filter(tag => tag !== null);
}

async function embedText(text) {
    const apiUrl = resolveOllamaUrl();
    const model = resolveEmbeddingModel();
    const response = await axios.post(
        `${apiUrl}/api/embeddings`,
        { model, prompt: text },
        { timeout: 120000 }
    );
    return response.data?.embedding || response.data?.data?.[0]?.embedding;
}

async function indexVisual(docId, metadata) {
    const original = await paperlessService.downloadOriginalDocument(docId);
    const fallback = original || await paperlessService.downloadDocument(docId);
    if (!fallback) {
        console.warn(`[Reingest] No PDF available for doc ${docId}`);
        return;
    }

    const images = await pdfRenderer.renderToBase64(fallback, {
        maxPages: MAX_VISION_PAGES
    });
    if (!images || images.length === 0) {
        console.warn(`[Reingest] No renderable pages for doc ${docId}`);
        return;
    }

    await visualSearchClient.indexDocument(
        docId,
        'images',
        metadata,
        images
    );
}

async function verifyMaxSimBaseline() {
    const baselinePath = process.env.MAXSIM_BASELINE_FILE ||
        path.join(process.cwd(), 'data', 'maxsim_baseline.json');
    if (!fs.existsSync(baselinePath)) {
        console.warn('[Verify] No MaxSim baseline file found, skipping');
        return;
    }

    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const queries = Array.isArray(baseline.queries) ? baseline.queries : [];
    if (queries.length === 0) {
        console.warn('[Verify] Baseline file contains no queries');
        return;
    }

    for (const entry of queries.slice(0, 10)) {
        const expectedScores = entry.scores || [];
        const tolerance = entry.tolerance ?? 0.05;
        const response = await visualSearchClient.searchWithFallback(
            entry.query,
            { k: Math.max(10, expectedScores.length) }
        );
        const results = response?.results || [];
        const scores = results.map(row => row.score).slice(0, expectedScores.length);

        scores.forEach((score, idx) => {
            const expected = expectedScores[idx];
            if (expected === undefined) return;
            const delta = Math.abs(score - expected);
            if (delta > tolerance) {
                console.warn(
                    `[Verify] ${entry.query} score ${idx} drift: ` +
                    `${score} vs ${expected} (delta ${delta.toFixed(4)})`
                );
            }
        });
    }
}

async function ingestDocuments(documents, options) {
    for (let i = 0; i < documents.length; i += options.batchSize) {
        const batch = documents.slice(i, i + options.batchSize);
        console.log(`[Reingest] Processing batch ${i / options.batchSize + 1}`);

        for (const doc of batch) {
            const docId = doc.id || doc.doc_id || doc.document_id;
            if (!docId) continue;

            const fullDoc = doc.content ? doc : await paperlessService.getDocument(docId);
            const correspondentId = extractCorrespondentId(fullDoc || doc);
            const tagIds = extractTagIds(fullDoc || doc);
            const title = fullDoc?.title || doc.title || '';
            const correspondent = fullDoc?.correspondent || doc.correspondent || '';
            const content = fullDoc?.content || '';
            const text = `${title} ${correspondent} ${content}`.trim();

            const embedding = await embedText(text);
            if (!Array.isArray(embedding)) {
                console.warn(`[Reingest] Missing embedding for doc ${docId}`);
                continue;
            }

            await qdrantAdapter.upsertDocumentEmbeddings([
                {
                    id: docId,
                    embedding,
                    payload: {
                        doc_id: docId,
                        correspondent_id: correspondentId,
                        tag_ids: tagIds
                    },
                    docId,
                    correspondentId,
                    tagIds
                }
            ]);

            await indexVisual(docId, {
                doc_id: docId,
                correspondent_id: correspondentId,
                tag_ids: tagIds
            });
        }
    }
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

    console.log('Initializing Qdrant...');
    await qdrantAdapter.initialize();

    const health = await qdrantAdapter.healthCheck();
    if (!health.healthy) {
        console.error('Qdrant is not healthy:', health.error);
        process.exit(1);
    }

    const allDocs = options.docIds?.length
        ? await Promise.all(options.docIds.map(id => paperlessService.getDocument(id)))
        : await paperlessService.getAllDocuments();

    const documents = allDocs.filter(Boolean);
    if (options.dryRun) {
        console.log('[DRY RUN] Would process documents:', documents.map(d => d.id));
        process.exit(0);
    }

    await ingestDocuments(documents, options);

    if (options.verify) {
        await verifyMaxSimBaseline();
    }

    console.log();
    console.log('='.repeat(60));
    console.log('Re-ingestion complete');
    console.log('='.repeat(60));
}

main().catch(error => {
    console.error('Error during re-ingestion:', error.message);
    process.exit(1);
});
