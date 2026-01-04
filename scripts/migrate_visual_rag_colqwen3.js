#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../services/logger');
const { visualSearchClient } = require('../services/visual-rag/VisualSearchClient');
const paperlessService = require('../services/paperlessService');

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_INDEX_NAME = 'paperless_visual';
const DEFAULT_INDEX_DIR = '/data/indices';
const DEFAULT_INDEX_DIR_FALLBACK = path.join(process.cwd(), 'data', 'visual_indices');
const MODEL_NAME = process.env.VISUAL_RAG_MODEL || 'TomoroAI/tomoro-colqwen3-embed-8b';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const usage = `
Usage: node scripts/migrate_visual_rag_colqwen3.js [--dry-run] [--batch-size N] [--doc-ids 1,2,3]

Options:
  --dry-run        Show planned actions without modifying indices or re-indexing.
  --batch-size     Number of documents per batch (default: ${DEFAULT_BATCH_SIZE}).
  --doc-ids        Comma/space-separated list of Paperless document IDs to migrate.
  --help, -h       Show this help message.

Notes:
  - Test on a small subset first with --doc-ids before running a full migration.
  - Requires Paperless API credentials and a running Visual RAG sidecar.
`;

function parseArgs(argv) {
  const options = {
    dryRun: false,
    batchSize: DEFAULT_BATCH_SIZE,
    docIds: [],
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg.startsWith('--batch-size')) {
      const value = arg.includes('=') ? arg.split('=')[1] : argv[i + 1];
      if (!arg.includes('=')) i += 1;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --batch-size value: ${value}`);
      }
      options.batchSize = parsed;
      continue;
    }
    if (arg.startsWith('--doc-ids')) {
      const value = arg.includes('=') ? arg.split('=')[1] : argv[i + 1];
      if (!arg.includes('=')) i += 1;
      const parsed = String(value || '')
        .split(/[,\s]+/)
        .map(token => token.trim())
        .filter(Boolean)
        .map(token => Number.parseInt(token, 10))
        .filter(Number.isFinite);
      options.docIds.push(...parsed);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  options.docIds = Array.from(new Set(options.docIds));
  return options;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '').replace('T', '-').replace('Z', '');
}

function resolveIndexPaths() {
  const indexName = process.env.VISUAL_RAG_INDEX_NAME
    || process.env.DEFAULT_INDEX_NAME
    || DEFAULT_INDEX_NAME;

  const candidates = [
    process.env.VISUAL_RAG_INDEX_DIR,
    process.env.INDEX_DIR,
    DEFAULT_INDEX_DIR_FALLBACK,
    DEFAULT_INDEX_DIR
  ].filter(Boolean);

  let indexDir = candidates[0];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      indexDir = candidate;
      break;
    }
  }

  const indexPath = path.join(indexDir, indexName);
  const archiveDir = path.join(indexDir, 'archive');

  return { indexDir, indexName, indexPath, archiveDir };
}

function resolveRelativePdfPath(doc, docId) {
  const archiveFileName = doc.archive_file_name || doc.archive_filename || null;
  const originalFileName = doc.original_file_name || doc.original_filename || null;
  if (archiveFileName) {
    return path.posix.join('documents', 'archive', archiveFileName);
  }
  if (originalFileName) {
    return path.posix.join('documents', 'originals', originalFileName);
  }
  return path.posix.join('documents', 'originals', `doc-${docId}.pdf`);
}

async function waitForSidecarIdle(timeoutMs = 10 * 60 * 1000, pollMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await visualSearchClient.status();
    if (!status.indexing_in_progress) {
      return status;
    }
    await sleep(pollMs);
  }
  throw new Error('Timed out waiting for sidecar indexing to finish');
}

async function getSidecarError() {
  try {
    const response = await visualSearchClient.client.get('/error');
    return response?.data?.last_error || null;
  } catch (error) {
    logger.warn('[Migration] Failed to read sidecar error status', { error: error.message });
    return null;
  }
}

async function fetchDocumentIds(docIds) {
  if (docIds && docIds.length > 0) {
    return docIds.slice();
  }

  paperlessService.initialize();
  if (!paperlessService.client) {
    throw new Error('Paperless API not configured. Check PAPERLESS_API_URL and PAPERLESS_API_TOKEN.');
  }

  const ids = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await paperlessService.client.get('/documents/', {
      params: { page, page_size: 100, fields: 'id' }
    });
    const results = response?.data?.results || [];
    ids.push(...results.map(doc => doc.id).filter(Boolean));
    hasMore = response?.data?.next !== null;
    page += 1;
    await sleep(100);
  }

  return ids;
}

async function fetchDocument(docId) {
  return paperlessService.getDocument(docId);
}

async function archiveIndex({ indexPath, archiveDir, dryRun }) {
  if (!fs.existsSync(indexPath)) {
    logger.info('[Migration] No existing index found to archive', { indexPath });
    return { archivePath: null };
  }

  const archiveName = `colqwen2-${timestampSlug()}`;
  const archivePath = path.join(archiveDir, archiveName);

  if (dryRun) {
    logger.info('[Migration] Dry run: would archive index', { indexPath, archivePath });
    return { archivePath };
  }

  fs.mkdirSync(archiveDir, { recursive: true });
  fs.renameSync(indexPath, archivePath);
  logger.info('[Migration] Archived existing index', { indexPath, archivePath });
  return { archivePath };
}

async function rollbackIndex({ archivePath, indexPath, archiveDir, dryRun }) {
  if (!archivePath || !fs.existsSync(archivePath)) {
    logger.warn('[Migration] No archive found to restore', { archivePath });
    return;
  }

  if (dryRun) {
    logger.info('[Migration] Dry run: would rollback index', { archivePath, indexPath });
    return;
  }

  const failedPath = path.join(archiveDir, `colqwen3-failed-${timestampSlug()}`);
  if (fs.existsSync(indexPath)) {
    fs.renameSync(indexPath, failedPath);
    logger.warn('[Migration] Moved partial index aside before rollback', { failedPath });
  }

  fs.renameSync(archivePath, indexPath);
  logger.info('[Migration] Restored archived index after failure', { archivePath, indexPath });
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.log(usage);
    process.exit(1);
  }

  if (options.help) {
    console.log(usage);
    return;
  }

  if (options.docIds.length === 0 && !options.dryRun) {
    logger.warn('[Migration] Consider running with --doc-ids for a small test batch first.');
  }

  const { indexDir, indexName, indexPath, archiveDir } = resolveIndexPaths();

  const startTime = Date.now();
  logger.info('[Migration] Starting Visual RAG migration', {
    event: 'sidecar_migration_start',
    model: MODEL_NAME,
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    indexName,
    indexDir
  });

  let archivePath = null;
  let rollbackNeeded = false;
  const errors = [];
  let processed = 0;
  let successCount = 0;
  let skipped = 0;

  try {
    const docIds = await fetchDocumentIds(options.docIds);
    if (docIds.length === 0) {
      logger.warn('[Migration] No documents found to migrate.');
      return;
    }

    const { archivePath: archived } = await archiveIndex({
      indexPath,
      archiveDir,
      dryRun: options.dryRun
    });
    archivePath = archived;

    if (options.dryRun) {
      logger.info('[Migration] Dry run complete', {
        totalDocuments: docIds.length,
        batchSize: options.batchSize,
        archivePath,
        indexPath
      });
      return;
    }

    const sidecarAvailable = await visualSearchClient.isAvailable();
    if (!sidecarAvailable) {
      throw new Error('Visual RAG sidecar is not available.');
    }

    await waitForSidecarIdle();

    for (let offset = 0; offset < docIds.length; offset += options.batchSize) {
      const batch = docIds.slice(offset, offset + options.batchSize);
      logger.info('[Migration] Processing batch', {
        batchNumber: Math.floor(offset / options.batchSize) + 1,
        batchSize: batch.length,
        totalBatches: Math.ceil(docIds.length / options.batchSize)
      });

      for (const docId of batch) {
        processed += 1;
        const percent = Math.round((processed / docIds.length) * 100);
        try {
          const doc = await fetchDocument(docId);
          const pdfPath = resolveRelativePdfPath(doc, docId);

          if (doc.mime_type && doc.mime_type !== 'application/pdf') {
            skipped += 1;
            logger.warn('[Migration] Skipping non-PDF document', { docId, mimeType: doc.mime_type });
            continue;
          }

          const lastError = await getSidecarError();
          await visualSearchClient.indexDocument(docId, pdfPath, {
            paperless_doc_id: docId,
            title: doc.title || null
          });
          await waitForSidecarIdle();
          const nextError = await getSidecarError();

          if (nextError && nextError !== lastError) {
            throw new Error(`Sidecar indexing error: ${nextError}`);
          }

          successCount += 1;
          logger.info('[Migration] Indexed document', {
            docId,
            pdfPath,
            progress: `${processed}/${docIds.length}`,
            percent
          });
        } catch (error) {
          errors.push({ docId, error: error.message });
          logger.error('[Migration] Document indexing failed', {
            docId,
            error: error.message,
            progress: `${processed}/${docIds.length}`,
            percent
          });
        }
      }
    }

    if (errors.length > 0) {
      rollbackNeeded = true;
      throw new Error(`Migration completed with ${errors.length} errors`);
    }

    logger.info('[Migration] Migration complete', {
      event: 'sidecar_migration_complete',
      totalDocuments: docIds.length,
      processed,
      successCount,
      skipped,
      durationMs: Date.now() - startTime
    });
  } catch (error) {
    rollbackNeeded = true;
    logger.error('[Migration] Migration failed', {
      event: 'sidecar_migration_error',
      error: error.message,
      processed,
      successCount,
      skipped,
      errors: errors.slice(0, 10)
    });

    if (rollbackNeeded && archivePath) {
      await rollbackIndex({ archivePath, indexPath, archiveDir, dryRun: options.dryRun });
    }

    process.exitCode = 1;
  }
}

main();
