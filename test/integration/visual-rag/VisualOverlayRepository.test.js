/* eslint-env mocha */
/**
 * Integration tests for VisualOverlayRepository
 *
 * These tests verify CRUD operations against a real PostgreSQL database.
 * Requires PostgreSQL to be running with the visual_overlays table created.
 *
 * Run: npm test -- --grep "VisualOverlayRepository"
 */

const assert = require('assert');
const { waitForConnection, cleanupTestData, getRepository } = require('./test-utils');
const {
    TEST_DOC_ID,
    TEST_DOC_ID_ALT,
    SAMPLE_OVERLAYS,
    createOverlay,
    createOverlayBatch
} = require('./fixtures');

describe('VisualOverlayRepository integration', function () {
    // Increase timeout for database operations
    this.timeout(15000);

    let repository;
    let dbAvailable = false;

    before(async function () {
        repository = getRepository();

        // Wait for database connection
        dbAvailable = await waitForConnection(3, 2000);

        if (!dbAvailable) {
            console.warn('⚠️  PostgreSQL not available - skipping VisualOverlayRepository tests');
            this.skip();
            return;
        }

        // Clean up any leftover test data
        await cleanupTestData([TEST_DOC_ID, TEST_DOC_ID_ALT]);
    });

    after(async function () {
        if (dbAvailable) {
            // Clean up test data
            await cleanupTestData([TEST_DOC_ID, TEST_DOC_ID_ALT]);
        }
    });

    afterEach(async function () {
        if (dbAvailable) {
            // Clean up after each test for isolation
            await cleanupTestData([TEST_DOC_ID, TEST_DOC_ID_ALT]);
        }
    });

    // =========================================================================
    // Connection Tests
    // =========================================================================

    describe('isAvailable()', function () {
        it('should return true when connected to PostgreSQL', async function () {
            const available = await repository.isAvailable();
            assert.strictEqual(available, true, 'Expected isAvailable() to return true');
        });
    });

    // =========================================================================
    // Save Operations
    // =========================================================================

    describe('saveOverlay()', function () {
        it('should save a single overlay and return with id', async function () {
            const overlay = createOverlay({ label: 'test-single' });

            const result = await repository.saveOverlay(
                TEST_DOC_ID,
                overlay.pageNumber,
                overlay.overlayData,
                overlay.semanticLabel
            );

            assert.ok(result.id, 'Expected result to have an id');
            assert.strictEqual(result.docId, TEST_DOC_ID);
            assert.strictEqual(result.pageNumber, overlay.pageNumber);
            assert.strictEqual(result.semanticLabel, overlay.semanticLabel);
            assert.deepStrictEqual(result.overlayData.label, overlay.overlayData.label);
        });

        it('should save overlay with complex overlayData', async function () {
            const complexData = {
                label: 'invoice-total',
                box: [450, 800, 550, 830],
                confidence: 0.97,
                value: '€1,234.56',
                currency: 'EUR',
                formatted: true
            };

            const result = await repository.saveOverlay(
                TEST_DOC_ID,
                1,
                complexData,
                'invoice-total'
            );

            assert.ok(result.id);
            assert.strictEqual(result.overlayData.value, '€1,234.56');
            assert.strictEqual(result.overlayData.currency, 'EUR');
        });
    });

    describe('saveOverlays()', function () {
        it('should batch save multiple overlays in transaction', async function () {
            const results = await repository.saveOverlays(TEST_DOC_ID, SAMPLE_OVERLAYS);

            assert.strictEqual(results.length, SAMPLE_OVERLAYS.length);
            results.forEach((result, i) => {
                assert.ok(result.id, `Expected result ${i} to have an id`);
                assert.strictEqual(result.docId, TEST_DOC_ID);
            });
        });

        it('should handle empty array gracefully', async function () {
            const results = await repository.saveOverlays(TEST_DOC_ID, []);
            assert.deepStrictEqual(results, []);
        });

        it('should save 10 overlays efficiently', async function () {
            const batch = createOverlayBatch(10);
            const startTime = Date.now();

            const results = await repository.saveOverlays(TEST_DOC_ID, batch);

            const elapsed = Date.now() - startTime;
            assert.strictEqual(results.length, 10);
            assert.ok(elapsed < 5000, `Expected batch insert to complete in <5s, took ${elapsed}ms`);
        });
    });

    // =========================================================================
    // Read Operations
    // =========================================================================

    describe('getByDocId()', function () {
        beforeEach(async function () {
            await repository.saveOverlays(TEST_DOC_ID, SAMPLE_OVERLAYS);
        });

        it('should retrieve all overlays for a document', async function () {
            const overlays = await repository.getByDocId(TEST_DOC_ID);

            assert.strictEqual(overlays.length, SAMPLE_OVERLAYS.length);
            overlays.forEach(overlay => {
                assert.strictEqual(overlay.docId, TEST_DOC_ID);
            });
        });

        it('should return empty array for non-existent document', async function () {
            const overlays = await repository.getByDocId(888888);
            assert.deepStrictEqual(overlays, []);
        });

        it('should order by page_number, id', async function () {
            const overlays = await repository.getByDocId(TEST_DOC_ID);

            // Check ordering
            for (let i = 1; i < overlays.length; i++) {
                const prev = overlays[i - 1];
                const curr = overlays[i];
                const validOrder = prev.pageNumber < curr.pageNumber ||
                    (prev.pageNumber === curr.pageNumber && prev.id < curr.id);
                assert.ok(validOrder, `Expected overlays to be ordered by page_number, id`);
            }
        });
    });

    describe('getByDocIdAndPage()', function () {
        beforeEach(async function () {
            await repository.saveOverlays(TEST_DOC_ID, SAMPLE_OVERLAYS);
        });

        it('should retrieve overlays for specific page', async function () {
            const page1Overlays = await repository.getByDocIdAndPage(TEST_DOC_ID, 1);
            const page2Overlays = await repository.getByDocIdAndPage(TEST_DOC_ID, 2);

            // SAMPLE_OVERLAYS has 2 overlays on page 1 and 2 on page 2
            assert.strictEqual(page1Overlays.length, 2);
            assert.strictEqual(page2Overlays.length, 2);

            page1Overlays.forEach(o => assert.strictEqual(o.pageNumber, 1));
            page2Overlays.forEach(o => assert.strictEqual(o.pageNumber, 2));
        });

        it('should return empty array for non-existent page', async function () {
            const overlays = await repository.getByDocIdAndPage(TEST_DOC_ID, 999);
            assert.deepStrictEqual(overlays, []);
        });
    });

    describe('getBySemanticLabel()', function () {
        beforeEach(async function () {
            await repository.saveOverlays(TEST_DOC_ID, SAMPLE_OVERLAYS);
            // Add some overlays with same label to another doc
            await repository.saveOverlay(TEST_DOC_ID_ALT, 1,
                { label: 'signature', box: [0, 0, 50, 50], confidence: 0.9 },
                'signature'
            );
        });

        it('should filter by semantic label across documents', async function () {
            const signatures = await repository.getBySemanticLabel('signature');

            // Should find signatures from both test docs
            assert.ok(signatures.length >= 2, 'Expected at least 2 signatures');
            signatures.forEach(o => assert.strictEqual(o.semanticLabel, 'signature'));
        });

        it('should respect limit parameter', async function () {
            const limited = await repository.getBySemanticLabel('signature', 1);
            assert.strictEqual(limited.length, 1);
        });

        it('should return empty for non-existent label', async function () {
            const none = await repository.getBySemanticLabel('nonexistent-label-xyz');
            assert.deepStrictEqual(none, []);
        });
    });

    describe('searchByOverlayData()', function () {
        beforeEach(async function () {
            await repository.saveOverlays(TEST_DOC_ID, SAMPLE_OVERLAYS);
        });

        it('should search by JSONB containment', async function () {
            const results = await repository.searchByOverlayData({ label: 'total' });

            assert.ok(results.length >= 1);
            results.forEach(r => assert.strictEqual(r.overlayData.label, 'total'));
        });

        it('should search by nested properties', async function () {
            // Search for overlay with specific value
            await repository.saveOverlay(TEST_DOC_ID, 1,
                { label: 'amount', value: '500.00', currency: 'EUR', box: [0, 0, 50, 50], confidence: 0.9 },
                'amount'
            );

            const results = await repository.searchByOverlayData({ currency: 'EUR' });
            assert.ok(results.length >= 1);
            results.forEach(r => assert.strictEqual(r.overlayData.currency, 'EUR'));
        });
    });

    describe('hasOverlays()', function () {
        it('should return true when document has overlays', async function () {
            await repository.saveOverlay(TEST_DOC_ID, 1,
                { label: 'test', box: [0, 0, 100, 100], confidence: 0.9 },
                'test'
            );

            const has = await repository.hasOverlays(TEST_DOC_ID);
            assert.strictEqual(has, true);
        });

        it('should return false when document has no overlays', async function () {
            const has = await repository.hasOverlays(777777);
            assert.strictEqual(has, false);
        });
    });

    // =========================================================================
    // Delete Operations
    // =========================================================================

    describe('deleteByDocId()', function () {
        beforeEach(async function () {
            await repository.saveOverlays(TEST_DOC_ID, SAMPLE_OVERLAYS);
        });

        it('should delete all overlays for a document', async function () {
            const deleted = await repository.deleteByDocId(TEST_DOC_ID);

            assert.strictEqual(deleted, SAMPLE_OVERLAYS.length);

            // Verify deletion
            const remaining = await repository.getByDocId(TEST_DOC_ID);
            assert.deepStrictEqual(remaining, []);
        });

        it('should return 0 when deleting non-existent document', async function () {
            const deleted = await repository.deleteByDocId(666666);
            assert.strictEqual(deleted, 0);
        });

        it('should not affect other documents', async function () {
            // Save to alternate doc
            await repository.saveOverlay(TEST_DOC_ID_ALT, 1,
                { label: 'other', box: [0, 0, 50, 50], confidence: 0.9 },
                'other'
            );

            // Delete from main test doc
            await repository.deleteByDocId(TEST_DOC_ID);

            // Verify alternate doc still has data
            const altOverlays = await repository.getByDocId(TEST_DOC_ID_ALT);
            assert.strictEqual(altOverlays.length, 1);
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================

    describe('Edge Cases', function () {
        it('should handle unicode labels', async function () {
            const result = await repository.saveOverlay(TEST_DOC_ID, 1,
                { label: 'Rechnungsdatum 日期', box: [0, 0, 100, 100], confidence: 0.9 },
                'Rechnungsdatum 日期'
            );

            assert.ok(result.id);
            assert.strictEqual(result.semanticLabel, 'Rechnungsdatum 日期');
        });

        it('should handle very long labels (up to 255 chars)', async function () {
            const longLabel = 'a'.repeat(255);
            const result = await repository.saveOverlay(TEST_DOC_ID, 1,
                { label: longLabel, box: [0, 0, 100, 100], confidence: 0.9 },
                longLabel
            );

            assert.ok(result.id);
            assert.strictEqual(result.semanticLabel.length, 255);
        });

        it('should handle null semantic label', async function () {
            const result = await repository.saveOverlay(TEST_DOC_ID, 1,
                { label: 'no-semantic', box: [0, 0, 100, 100], confidence: 0.9 },
                null
            );

            assert.ok(result.id);
            // semanticLabel should fall back to overlayData.label
            assert.strictEqual(result.semanticLabel, 'no-semantic');
        });
    });
});
