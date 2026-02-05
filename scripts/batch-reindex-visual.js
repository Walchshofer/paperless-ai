#!/usr/bin/env node
'use strict';

const VALID_DOMAINS = ['medical', 'financial', 'legal', 'general'];
const DEFAULT_OPTIONS = Object.freeze({
    start: null,
    end: null,
    domain: null,
    batchSize: 100,
    rateLimit: 10,
    maxRetries: 3,
    retryBaseDelayMs: 500,
    dpi: 300,
    progressBarWidth: 24,
    help: false
});

const USAGE = `
Usage: npm run reindex:visual -- [options]

Examples:
  npm run reindex:visual
  npm run reindex:visual -- --start=1000 --end=2000
  npm run reindex:visual -- --domain=financial

Options:
  --start <docId>        Inclusive document id lower bound
  --end <docId>          Inclusive document id upper bound
  --domain <name>        Domain filter: medical|financial|legal|general
  --batch-size <count>   Documents per batch window (default: 100)
  --rate-limit <n>       Max documents/sec (default: 10)
  --max-retries <n>      Retries per failed document (default: 3)
  --dpi <n>              PDF render DPI (default: 300)
  --help, -h             Show this message
`;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function toInteger(value, optionName) {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid ${optionName}: ${value}`);
    }
    return parsed;
}

function getArgValue(argv, index, arg) {
    if (arg.includes('=')) {
        return arg.split('=').slice(1).join('=');
    }
    if (index + 1 >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
    }
    return argv[index + 1];
}

function normalizeDomain(value) {
    if (!value) {
        return null;
    }
    const normalized = String(value).trim().toLowerCase();
    if (normalized === '' || normalized === 'all') {
        return null;
    }
    if (!VALID_DOMAINS.includes(normalized)) {
        throw new Error(
            `Invalid --domain value "${value}". ` +
            `Use one of: ${VALID_DOMAINS.join(', ')}`
        );
    }
    return normalized;
}

function parseArgs(argv) {
    const options = { ...DEFAULT_OPTIONS };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }
        if (arg.startsWith('--start')) {
            const rawValue = getArgValue(argv, i, arg);
            options.start = toInteger(rawValue, '--start');
            if (!arg.includes('=')) {
                i += 1;
            }
            continue;
        }
        if (arg.startsWith('--end')) {
            const rawValue = getArgValue(argv, i, arg);
            options.end = toInteger(rawValue, '--end');
            if (!arg.includes('=')) {
                i += 1;
            }
            continue;
        }
        if (arg.startsWith('--domain')) {
            const rawValue = getArgValue(argv, i, arg);
            options.domain = normalizeDomain(rawValue);
            if (!arg.includes('=')) {
                i += 1;
            }
            continue;
        }
        if (arg.startsWith('--batch-size')) {
            const rawValue = getArgValue(argv, i, arg);
            options.batchSize = toInteger(rawValue, '--batch-size');
            if (options.batchSize <= 0) {
                throw new Error('--batch-size must be > 0');
            }
            if (!arg.includes('=')) {
                i += 1;
            }
            continue;
        }
        if (arg.startsWith('--rate-limit')) {
            const rawValue = getArgValue(argv, i, arg);
            options.rateLimit = toInteger(rawValue, '--rate-limit');
            if (options.rateLimit <= 0) {
                throw new Error('--rate-limit must be > 0');
            }
            if (!arg.includes('=')) {
                i += 1;
            }
            continue;
        }
        if (arg.startsWith('--max-retries')) {
            const rawValue = getArgValue(argv, i, arg);
            options.maxRetries = toInteger(rawValue, '--max-retries');
            if (options.maxRetries < 0) {
                throw new Error('--max-retries must be >= 0');
            }
            if (!arg.includes('=')) {
                i += 1;
            }
            continue;
        }
        if (arg.startsWith('--dpi')) {
            const rawValue = getArgValue(argv, i, arg);
            options.dpi = toInteger(rawValue, '--dpi');
            if (options.dpi <= 0) {
                throw new Error('--dpi must be > 0');
            }
            if (!arg.includes('=')) {
                i += 1;
            }
            continue;
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    if (options.start !== null && options.end !== null &&
        options.start > options.end) {
        throw new Error('--start must be <= --end');
    }

    return options;
}

function selectDocumentIds(documents, start = null, end = null) {
    return (documents || [])
        .map(doc => Number.parseInt(String(doc?.id), 10))
        .filter(id => Number.isInteger(id) && id > 0)
        .filter(id => start === null || id >= start)
        .filter(id => end === null || id <= end)
        .sort((a, b) => a - b);
}

function normalizeTagIds(tags) {
    if (!Array.isArray(tags)) {
        return [];
    }
    return tags
        .map(tag => {
            if (typeof tag === 'number') {
                return Number.isInteger(tag) ? tag : null;
            }
            if (typeof tag === 'string') {
                const parsed = Number.parseInt(tag, 10);
                return Number.isInteger(parsed) ? parsed : null;
            }
            if (typeof tag === 'object' && tag !== null) {
                const parsed = Number.parseInt(String(tag.id), 10);
                return Number.isInteger(parsed) ? parsed : null;
            }
            return null;
        })
        .filter(tag => Number.isInteger(tag) && tag >= 0);
}

function resolveRelativePdfPath(doc, docId) {
    const archiveFileName = doc.archive_file_name || doc.archive_filename;
    const originalFileName = doc.original_file_name ||
        doc.original_filename ||
        `doc-${docId}.pdf`;
    if (archiveFileName) {
        return `documents/archive/${archiveFileName}`;
    }
    return `documents/originals/${originalFileName}`;
}

function createProgressBar(percent, width) {
    const clamped = Math.max(0, Math.min(percent, 100));
    const filled = Math.round((clamped / 100) * width);
    return `${'='.repeat(filled)}${'-'.repeat(Math.max(0, width - filled))}`;
}

class BatchVisualReindexer {
    constructor(deps = {}) {
        let cachedDefaults = null;
        const getDefaults = () => {
            if (!cachedDefaults) {
                cachedDefaults = loadDefaultDeps();
            }
            return cachedDefaults;
        };
        const resolveDep = (value, key) => (
            value || getDefaults()[key]
        );

        this.logger = resolveDep(deps.logger, 'logger');
        this.paperlessService = resolveDep(
            deps.paperlessService,
            'paperlessService'
        );
        this.pdfRenderer = resolveDep(deps.pdfRenderer, 'pdfRenderer');
        this.visualIndexer = resolveDep(deps.visualIndexer, 'visualIndexer');
        this.domainResolver = resolveDep(deps.domainResolver, 'domainResolver');
        this.qdrantAdapter = resolveDep(deps.qdrantAdapter, 'qdrantAdapter');
        this.sleep = deps.sleep || sleep;
        this.now = deps.now || (() => Date.now());
        this.stdout = deps.stdout || process.stdout;
        this._nextTokenAt = 0;
    }

    async run(options = {}) {
        const config = { ...DEFAULT_OPTIONS, ...options };
        await this._ensureReady();

        const stats = {
            total: 0,
            processed: 0,
            success: 0,
            failed: 0,
            skipped: 0,
            retried: 0,
            pagesIndexed: 0,
            failedDocs: [],
            startMs: this.now(),
            durationMs: 0
        };

        const listMethod =
            typeof this.paperlessService.getAllDocumentsUnfiltered ===
                'function'
                ? 'getAllDocumentsUnfiltered'
                : 'getAllDocuments';
        const documents = await this.paperlessService[listMethod]();
        const docIds = selectDocumentIds(
            documents,
            config.start,
            config.end
        );
        stats.total = docIds.length;

        if (stats.total === 0) {
            this.logger.info(
                '[BatchVisualReindex] No documents found for selected range'
            );
            return { stats };
        }

        this.logger.info({
            event: 'visual_reindex_start',
            totalDocuments: stats.total,
            batchSize: config.batchSize,
            rateLimit: config.rateLimit,
            maxRetries: config.maxRetries,
            domainFilter: config.domain || 'all',
            hardware_target: 'RTX 3090 Ti'
        });

        this._renderProgress(stats, config, false);

        for (let offset = 0; offset < docIds.length; offset += config.batchSize) {
            const batch = docIds.slice(offset, offset + config.batchSize);
            this.logger.info({
                event: 'visual_reindex_batch_start',
                batchNumber: Math.floor(offset / config.batchSize) + 1,
                batchSize: batch.length,
                totalBatches: Math.ceil(docIds.length / config.batchSize)
            });

            for (const docId of batch) {
                await this._throttle(config.rateLimit);
                const result = await this._processDocument(docId, config, stats);

                stats.processed += 1;
                if (result.status === 'success') {
                    stats.success += 1;
                    stats.pagesIndexed += result.pagesIndexed;
                } else if (result.status === 'skipped') {
                    stats.skipped += 1;
                } else {
                    stats.failed += 1;
                    stats.failedDocs.push({
                        docId,
                        error: result.error
                    });
                }

                this._renderProgress(stats, config, false);
            }
        }

        stats.durationMs = this.now() - stats.startMs;
        const durationSec = Math.max(stats.durationMs / 1000, 0.001);
        const docsPerSecond = Number((stats.processed / durationSec).toFixed(2));

        this._renderProgress(stats, config, true);

        this.logger.info({
            event: 'visual_reindex_stats',
            totalDocuments: stats.total,
            processed: stats.processed,
            succeeded: stats.success,
            failed: stats.failed,
            skipped: stats.skipped,
            retried: stats.retried,
            pagesIndexed: stats.pagesIndexed,
            durationMs: stats.durationMs,
            docsPerSecond,
            hardware_target: 'RTX 3090 Ti'
        });

        if (stats.failed > 0) {
            this.logger.warn({
                event: 'visual_reindex_failures',
                failedCount: stats.failed,
                sample: stats.failedDocs.slice(0, 20)
            });
        }

        return { stats };
    }

    async _ensureReady() {
        const renderAvailable = await this.pdfRenderer.isAvailableAsync();
        if (!renderAvailable) {
            throw new Error('PDF rendering is not available');
        }

        await this.qdrantAdapter.initialize();
    }

    async _throttle(rateLimitPerSecond) {
        const intervalMs = Math.ceil(1000 / rateLimitPerSecond);
        const now = this.now();
        if (this._nextTokenAt === 0) {
            this._nextTokenAt = now;
        }

        if (now < this._nextTokenAt) {
            await this.sleep(this._nextTokenAt - now);
        }

        this._nextTokenAt = Math.max(now, this._nextTokenAt) + intervalMs;
    }

    async _resolveDocumentDomain(doc) {
        const documentType = typeof doc.document_type_name === 'string'
            ? doc.document_type_name
            : (typeof doc.document_type === 'string'
                ? doc.document_type
                : null);
        const tags = Array.isArray(doc.tags) ? doc.tags : [];
        const content = typeof doc.content === 'string' ? doc.content : '';

        try {
            const resolved = await this.domainResolver.resolveDomain(doc.id, {
                documentType,
                tags,
                content
            });
            return normalizeDomain(resolved) || 'general';
        } catch (error) {
            this.logger.warn({
                event: 'visual_reindex_domain_resolve_failed',
                docId: doc.id,
                error: error.message
            });
            return 'general';
        }
    }

    async _processDocument(docId, config, stats) {
        let lastError = null;

        for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
            try {
                const doc = await this.paperlessService.getDocument(docId);
                if (!doc) {
                    throw new Error('Document metadata not found');
                }

                if (doc.mime_type && doc.mime_type !== 'application/pdf') {
                    return {
                        status: 'skipped',
                        reason: 'non_pdf'
                    };
                }

                const resolvedDomain = await this._resolveDocumentDomain(doc);
                if (config.domain && resolvedDomain !== config.domain) {
                    return {
                        status: 'skipped',
                        reason: 'domain_mismatch'
                    };
                }

                let pdfBuffer = await this.paperlessService
                    .downloadOriginalDocument(docId);
                if (!pdfBuffer) {
                    pdfBuffer = await this.paperlessService
                        .downloadDocument(docId);
                }
                if (!pdfBuffer) {
                    throw new Error('Failed to download PDF');
                }

                const pageCount = Number.parseInt(
                    String(doc.page_count || doc.pageCount || ''),
                    10
                );
                const renderOptions = {
                    dpi: config.dpi,
                    docId: `batch-reindex-${docId}`
                };
                if (Number.isInteger(pageCount) && pageCount > 0) {
                    renderOptions.maxPages = pageCount;
                }

                const images = await this.pdfRenderer.renderBuffer(
                    pdfBuffer,
                    renderOptions
                );
                const base64Images = (images || [])
                    .map(image => image.base64)
                    .filter(value =>
                        typeof value === 'string' && value.length > 0
                    );

                if (base64Images.length === 0) {
                    throw new Error('No page images rendered for indexing');
                }

                const metadata = {
                    title: doc.title || null,
                    domain: resolvedDomain,
                    correspondent_id: Number.isInteger(doc.correspondent)
                        ? doc.correspondent
                        : null,
                    tag_ids: normalizeTagIds(doc.tags),
                    pdf_path: resolveRelativePdfPath(doc, docId)
                };

                const indexResult = await this.visualIndexer.indexDocument(
                    docId,
                    base64Images,
                    metadata
                );

                return {
                    status: 'success',
                    pagesIndexed: Number.isInteger(indexResult.pagesIndexed)
                        ? indexResult.pagesIndexed
                        : base64Images.length
                };
            } catch (error) {
                lastError = error;
                if (attempt < config.maxRetries) {
                    stats.retried += 1;
                    const delay = config.retryBaseDelayMs * (2 ** attempt);
                    this.logger.warn({
                        event: 'visual_reindex_retry',
                        docId,
                        attempt: attempt + 1,
                        maxRetries: config.maxRetries,
                        delayMs: delay,
                        error: error.message
                    });
                    await this.sleep(delay);
                    continue;
                }
            }
        }

        return {
            status: 'failed',
            error: lastError ? lastError.message : 'Unknown error'
        };
    }

    _renderProgress(stats, config, isFinal) {
        const percent = stats.total > 0
            ? Math.floor((stats.processed / stats.total) * 100)
            : 100;
        const bar = createProgressBar(percent, config.progressBarWidth);
        const line =
            `[${bar}] ${percent}% ${stats.processed}/${stats.total}` +
            ` ok:${stats.success}` +
            ` fail:${stats.failed}` +
            ` skip:${stats.skipped}` +
            ` retry:${stats.retried}`;

        if (this.stdout && this.stdout.isTTY) {
            this.stdout.write(`\r${line}`);
            if (isFinal) {
                this.stdout.write('\n');
            }
            return;
        }

        if (isFinal || stats.processed === 0 || stats.processed % 25 === 0) {
            this.logger.info(`[BatchVisualReindex] ${line}`);
        }
    }
}

function loadDefaultDeps() {
    const appLogger = require('../services/logger');
    const appPaperlessService = require('../services/paperlessService');
    const visualServices = require('../services/visual-rag-client');
    const { qdrantAdapter: adapter } = require(
        '../services/visual-rag-client/QdrantAdapter'
    );
    return {
        logger: appLogger,
        paperlessService: appPaperlessService,
        pdfRenderer: visualServices.pdfRenderer,
        visualIndexer: visualServices.visualIndexer,
        domainResolver: visualServices.domainResolver,
        qdrantAdapter: adapter
    };
}

async function main() {
    let options;
    try {
        options = parseArgs(process.argv.slice(2));
    } catch (error) {
        console.error(`Error: ${error.message}`);
        console.log(USAGE);
        process.exit(1);
    }

    if (options.help) {
        console.log(USAGE);
        return;
    }

    try {
        const reindexer = new BatchVisualReindexer();
        const result = await reindexer.run(options);
        if (result.stats.failed > 0) {
            process.exitCode = 1;
        }
    } catch (error) {
        const runtimeLogger = require('../services/logger');
        runtimeLogger.error('[BatchVisualReindex] Fatal error', {
            error: error.message
        });
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    BatchVisualReindexer,
    DEFAULT_OPTIONS,
    VALID_DOMAINS,
    USAGE,
    parseArgs,
    normalizeDomain,
    selectDocumentIds,
    normalizeTagIds,
    resolveRelativePdfPath,
    createProgressBar
};
