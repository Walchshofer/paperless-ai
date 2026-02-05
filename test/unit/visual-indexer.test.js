/* eslint-env mocha */

const assert = require('assert');
const { VisualIndexer } = require('../../services/visual-rag-client/VisualIndexer');

describe('VisualIndexer', function () {
    it('indexes pages and records indexing telemetry', async function () {
        let indexCallArgs = null;
        let stageLatency = null;
        const mockClient = {
            indexDocument: async (...args) => {
                indexCallArgs = args;
                return {
                    status: 'success',
                    document: { doc_id: args[0] }
                };
            }
        };
        const mockMetrics = {
            recordStageLatency: (stage, type, durationMs) => {
                stageLatency = { stage, type, durationMs };
            }
        };
        const indexer = new VisualIndexer({
            visualSearchClient: mockClient,
            metricsCollector: mockMetrics
        });

        const result = await indexer.indexDocument(
            42,
            ['img-page-1', { base64: 'img-page-2' }],
            {
                domain: 'FINANCIAL',
                correspondent: '7',
                tags: ['1', 'x', 2]
            }
        );

        assert.ok(indexCallArgs, 'sidecar client should be called');
        assert.strictEqual(indexCallArgs[0], 42);
        assert.strictEqual(indexCallArgs[1], null);
        assert.deepStrictEqual(indexCallArgs[3], ['img-page-1', 'img-page-2']);
        assert.strictEqual(indexCallArgs[2].domain, 'financial');
        assert.strictEqual(indexCallArgs[2].correspondent_id, 7);
        assert.deepStrictEqual(indexCallArgs[2].tag_ids, [1, 2]);
        assert.ok(indexCallArgs[2].indexed_at, 'indexed_at should be set');

        assert.strictEqual(result.status, 'success');
        assert.strictEqual(result.pagesIndexed, 2);
        assert.ok(result.indexingLatencyMs >= 0);
        assert.ok(result.perPageLatencyMs >= 0);
        assert.strictEqual(stageLatency.stage, 'visual_indexing');
        assert.strictEqual(stageLatency.type, 'ingestion');
    });

    it('rejects when page images are missing', async function () {
        const indexer = new VisualIndexer({
            visualSearchClient: { indexDocument: async () => ({}) }
        });

        await assert.rejects(
            async () => {
                await indexer.indexDocument(1, [], {});
            },
            /at least one page image/i
        );
    });
});
