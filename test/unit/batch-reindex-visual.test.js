const assert = require('assert');
const {
    BatchVisualReindexer,
    parseArgs,
    selectDocumentIds
} = require('../../scripts/batch-reindex-visual');

describe('batch-reindex-visual parseArgs', () => {
    it('parses start/end/domain and defaults', () => {
        const options = parseArgs([
            '--start=1000',
            '--end',
            '2000',
            '--domain',
            'financial'
        ]);

        assert.strictEqual(options.start, 1000);
        assert.strictEqual(options.end, 2000);
        assert.strictEqual(options.domain, 'financial');
        assert.strictEqual(options.batchSize, 100);
        assert.strictEqual(options.rateLimit, 10);
    });

    it('rejects invalid domains', () => {
        assert.throws(
            () => parseArgs(['--domain=unknown']),
            /Invalid --domain/
        );
    });

    it('rejects start greater than end', () => {
        assert.throws(
            () => parseArgs(['--start=20', '--end=10']),
            /--start must be <= --end/
        );
    });
});

describe('batch-reindex-visual helpers', () => {
    it('selectDocumentIds keeps range and numeric ordering', () => {
        const ids = selectDocumentIds(
            [{ id: 7 }, { id: 2 }, { id: '20' }, { id: 'x' }],
            3,
            20
        );
        assert.deepStrictEqual(ids, [7, 20]);
    });
});

describe('BatchVisualReindexer', () => {
    it('retries failures and filters by domain', async () => {
        const docs = {
            1: {
                id: 1,
                title: 'Invoice 1',
                mime_type: 'application/pdf',
                correspondent: 11,
                tags: [101, 102],
                page_count: 1
            },
            2: {
                id: 2,
                title: 'Invoice 2',
                mime_type: 'application/pdf',
                correspondent: 12,
                tags: [103],
                page_count: 1
            },
            3: {
                id: 3,
                title: 'Contract',
                mime_type: 'application/pdf',
                correspondent: 13,
                tags: [201],
                page_count: 1
            }
        };

        let initializeCalls = 0;
        let firstDoc2Failure = true;
        const indexCalls = [];
        const sleepCalls = [];

        const reindexer = new BatchVisualReindexer({
            logger: {
                info: () => {},
                warn: () => {},
                error: () => {},
                debug: () => {}
            },
            paperlessService: {
                getAllDocumentsUnfiltered: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
                getDocument: async (docId) => docs[docId],
                downloadOriginalDocument: async () => Buffer.from('%PDF-1.4'),
                downloadDocument: async () => Buffer.from('%PDF-1.4')
            },
            pdfRenderer: {
                isAvailableAsync: async () => true,
                renderBuffer: async () => [{ base64: 'ZmFrZQ==' }]
            },
            visualIndexer: {
                indexDocument: async (docId, images, metadata) => {
                    indexCalls.push({ docId, images, metadata });
                    if (docId === 2 && firstDoc2Failure) {
                        firstDoc2Failure = false;
                        throw new Error('transient sidecar failure');
                    }
                    return { pagesIndexed: 1 };
                }
            },
            domainResolver: {
                resolveDomain: async (docId) => (
                    docId === 3 ? 'legal' : 'financial'
                )
            },
            qdrantAdapter: {
                initialize: async () => {
                    initializeCalls += 1;
                }
            },
            sleep: async (ms) => {
                sleepCalls.push(ms);
            },
            stdout: {
                isTTY: false,
                write: () => {}
            }
        });

        const result = await reindexer.run({
            domain: 'financial',
            batchSize: 2,
            maxRetries: 1,
            rateLimit: 1000
        });

        assert.strictEqual(initializeCalls, 1);
        assert.strictEqual(result.stats.total, 3);
        assert.strictEqual(result.stats.processed, 3);
        assert.strictEqual(result.stats.success, 2);
        assert.strictEqual(result.stats.skipped, 1);
        assert.strictEqual(result.stats.failed, 0);
        assert.strictEqual(result.stats.retried, 1);
        assert.ok(indexCalls.length >= 3);
        assert.ok(
            indexCalls.some(call => call.docId === 1 &&
                call.metadata.correspondent_id === 11)
        );
        assert.ok(
            indexCalls.some(call =>
                call.docId === 1 &&
                Array.isArray(call.metadata.tag_ids) &&
                call.metadata.tag_ids.length === 2
            )
        );
        assert.ok(sleepCalls.some(ms => ms >= 500));
    });
});
