/* eslint-env mocha */

const assert = require('assert');
const { IngestionManager } = require('../../services/visual-rag-client/IngestionManager');

describe('IngestionManager universal indexing', function () {
    function createManager(overrides = {}) {
        const indexed = { images: null };
        const manager = new IngestionManager({
            visualSearchClient: {
                isAvailable: async () => true
            },
            visualIndexer: {
                indexDocument: async (_docId, images) => {
                    indexed.images = images;
                    return {
                        status: 'success',
                        document: { doc_id: 99 },
                        pagesIndexed: images.length,
                        indexingLatencyMs: 30,
                        perPageLatencyMs: images.length > 0
                            ? 30 / images.length
                            : 30
                    };
                }
            },
            overlayExtractor: {
                extractOverlaysMultiPage: async () => [],
                unloadModel: async () => {}
            },
            overlayRepository: {
                isAvailable: async () => false
            },
            hybridSearchService: {},
            domainResolver: { resolveDomain: async () => 'general' },
            overlayRefiner: { getStats: () => ({}) },
            pdfRenderer: {
                isAvailableAsync: async () => true,
                renderBuffer: async () => [
                    { base64: 'rendered-1' },
                    { base64: 'rendered-2' },
                    { base64: 'rendered-3' }
                ]
            },
            paperlessService: {
                getDocument: async () => ({ page_count: 3 }),
                downloadOriginalDocument: async () => Buffer.from('%PDF-mock'),
                downloadDocument: async () => null,
                getDocumentContent: async () => ''
            },
            enableOverlayExtraction: false,
            indexAllPages: true,
            ...overrides
        });

        return { manager, indexed };
    }

    it('indexes all rendered pages when universal indexing is enabled', async function () {
        const { manager, indexed } = createManager();

        const result = await manager._indexVisually(
            99,
            'documents/originals/mock.pdf',
            { domain: 'general' },
            ['provided-single-page']
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.pagesIndexed, 3);
        assert.deepStrictEqual(
            indexed.images,
            ['rendered-1', 'rendered-2', 'rendered-3']
        );
    });

    it('falls back to provided images if full render fails', async function () {
        const { manager, indexed } = createManager({
            pdfRenderer: {
                isAvailableAsync: async () => true,
                renderBuffer: async () => {
                    throw new Error('render failed');
                }
            }
        });

        const result = await manager._indexVisually(
            99,
            'documents/originals/mock.pdf',
            { domain: 'general' },
            ['provided-1', 'provided-2']
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.pagesIndexed, 2);
        assert.deepStrictEqual(indexed.images, ['provided-1', 'provided-2']);
    });

    it('skips indexing when sidecar is unavailable', async function () {
        const { manager } = createManager({
            visualSearchClient: {
                isAvailable: async () => false
            }
        });

        const result = await manager._indexVisually(99, 'a.pdf', {}, []);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.skipped, true);
    });
});
