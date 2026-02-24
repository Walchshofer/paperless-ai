/* eslint-env mocha */

/**
 * test/integration/batch-normalization.test.js
 *
 * Integration tests for batch normalization functionality
 */

const assert = require('assert');
const { BatchNormalizationJob } = require('../../services/normalization/BatchNormalizationJob');

describe('Batch Normalization Integration', () => {
    let mockPaperlessService;
    let mockNormalizer;
    let mockStore;

    beforeEach(() => {
        // Mock paperless service with realistic data
        mockPaperlessService = {
            getAllDocuments: async () => [
                { 
                    id: 1, 
                    title: 'Test Doc 1', 
                    custom_fields: { ai_normalization_status: 'pending' } 
                },
                { 
                    id: 2, 
                    title: 'Test Doc 2', 
                    custom_fields: { ai_normalization_status: 'completed' } 
                },
                { 
                    id: 3, 
                    title: 'Test Doc 3', 
                    custom_fields: {} 
                },
                { 
                    id: 4, 
                    title: 'Test Doc 4', 
                    custom_fields: { ai_normalization_status: 'failed' } 
                }
            ]
        };

        // Mock normalizer with realistic behavior
        mockNormalizer = {
            analyzeAndNormalize: async (docId) => {
                // Simulate different outcomes for different documents
                if (docId === 1) {
                    return {
                        changesDetected: true,
                        actions: [{ action: 'rotate', angle: 90 }],
                        normalizedPages: [
                            { pageNumber: 1, buffer: Buffer.from('page1') }
                        ]
                    };
                } else if (docId === 4) {
                    throw new Error('Normalization failed');
                } else {
                    return {
                        changesDetected: false,
                        actions: [],
                        normalizedPages: null
                    };
                }
            }
        };

        // Mock store with state tracking
        const documentStatuses = {};
        mockStore = {
            getStatus: async (docId) => {
                return { 
                    status: documentStatuses[docId] || 'pending',
                    isNormalized: documentStatuses[docId] === 'completed'
                };
            },
            updatePaperlessMetadata: async (docId, status, _error) => {
                documentStatuses[docId] = status;
            },
            store: async (docId, _pages) => {
                documentStatuses[docId] = 'completed';
            },
            isNormalized: async (docId) => {
                return documentStatuses[docId] === 'completed';
            }
        };
    });

    describe('Batch Processing', () => {
        it('should process pending documents', async () => {
            const job = new BatchNormalizationJob({
                paperlessService: mockPaperlessService,
                normalizer: mockNormalizer,
                store: mockStore,
                concurrency: 1
            });

            const result = await job.run({ limit: 10, dryRun: false });

            assert.strictEqual(result.status, 'completed');
            assert.strictEqual(result.stats.total, 3); // 1, 3, 4 (skipping completed doc 2)
            assert.strictEqual(result.stats.processed, 3);
            assert.strictEqual(result.stats.succeeded, 2); // 1 and 3
            assert.strictEqual(result.stats.failed, 1); // 4
        });

        it('should skip completed documents', async () => {
            // Mark doc 2 as completed in paperless
            const job = new BatchNormalizationJob({
                paperlessService: mockPaperlessService,
                normalizer: mockNormalizer,
                store: mockStore,
                concurrency: 1
            });

            const pending = await job.findPendingDocuments(10);
            
            // Should not include doc 2 (completed)
            const docIds = pending.map(d => d.id);
            assert(!docIds.includes(2));
            assert(docIds.includes(1));
            assert(docIds.includes(3));
            assert(docIds.includes(4));
        });

        it('should handle failures gracefully', async () => {
            const job = new BatchNormalizationJob({
                paperlessService: mockPaperlessService,
                normalizer: mockNormalizer,
                store: mockStore,
                concurrency: 1
            });

            const result = await job.run({ limit: 10, dryRun: false });

            // Job should complete despite doc 4 failing
            assert.strictEqual(result.status, 'completed');
            assert.strictEqual(result.stats.failed, 1);
            assert.strictEqual(result.errors.length, 1);
            assert.strictEqual(result.errors[0].docId, 4);
            assert(result.errors[0].error.includes('Normalization failed'));
        });

        it('should persist normalized images when changes detected', async () => {
            let storedDocs = [];
            mockStore.store = async (docId, pages) => {
                storedDocs.push({ docId, pageCount: pages.length });
            };

            const job = new BatchNormalizationJob({
                paperlessService: mockPaperlessService,
                normalizer: mockNormalizer,
                store: mockStore,
                concurrency: 1
            });

            await job.run({ limit: 10, dryRun: false });

            // Should have stored normalized pages for doc 1
            assert.strictEqual(storedDocs.length, 1);
            assert.strictEqual(storedDocs[0].docId, 1);
            assert.strictEqual(storedDocs[0].pageCount, 1);
        });

        it('should respect concurrency limits', async () => {
            let concurrentCalls = 0;
            let maxConcurrent = 0;

            mockNormalizer.analyzeAndNormalize = async (_docId) => {
                concurrentCalls++;
                maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
                
                // Simulate processing time
                await new Promise(resolve => setTimeout(resolve, 10));
                
                concurrentCalls--;
                return { changesDetected: false, actions: [], normalizedPages: null };
            };

            const job = new BatchNormalizationJob({
                paperlessService: mockPaperlessService,
                normalizer: mockNormalizer,
                store: mockStore,
                concurrency: 2
            });

            await job.run({ limit: 3, dryRun: false });

            // Should never exceed concurrency limit
            assert(maxConcurrent <= 2);
        });
    });

    describe('API Integration', () => {
        it('should trigger single document normalization', async () => {
            // Simulate API call to /api/normalization/trigger
            const docId = 1;
            const force = false;

            const normalizer = mockNormalizer;
            const store = mockStore;

            // Check if already normalized
            if (!force) {
                const isNormalized = await store.isNormalized(docId);
                if (isNormalized) {
                    assert.fail('Should not normalize already-normalized document');
                }
            }

            // Update status to processing
            await store.updatePaperlessMetadata(docId, 'processing', null);

            // Run normalization
            const result = await normalizer.analyzeAndNormalize(docId);

            // Store if changes detected
            if (result.changesDetected) {
                await store.store(docId, result.normalizedPages);
            } else {
                await store.updatePaperlessMetadata(docId, 'skipped', null);
            }

            assert.strictEqual(result.changesDetected, true);
            assert.strictEqual(result.normalizedPages.length, 1);
        });

        it('should query normalization status', async () => {
            const docId = 1;
            
            // Update status
            await mockStore.updatePaperlessMetadata(docId, 'completed', null);

            // Query status (simulating API call)
            const status = await mockStore.getStatus(docId);

            assert.strictEqual(status.status, 'completed');
            assert.strictEqual(status.isNormalized, true);
        });

        it('should support batch job via API', async () => {
            const limit = 10;
            const dryRun = false;
            const force = false;
            const concurrency = 2;

            // Create and run batch job (simulating API call)
            const job = new BatchNormalizationJob({ 
                paperlessService: mockPaperlessService,
                normalizer: mockNormalizer,
                store: mockStore,
                concurrency 
            });
            
            const result = await job.run({ limit, dryRun, force });

            assert.strictEqual(result.status, 'completed');
            assert(result.stats.total > 0);
            assert(result.stats.processed > 0);
            assert(result.jobId);
        });
    });

    describe('Status Updates', () => {
        it('should update status to processing before normalization', async () => {
            const job = new BatchNormalizationJob({
                paperlessService: mockPaperlessService,
                normalizer: mockNormalizer,
                store: mockStore,
                concurrency: 1
            });

            let statusUpdates = [];
            const originalUpdate = mockStore.updatePaperlessMetadata;
            mockStore.updatePaperlessMetadata = async (docId, status, error) => {
                statusUpdates.push({ docId, status, error });
                return originalUpdate(docId, status, error);
            };

            await job.run({ limit: 1, dryRun: false });

            // Should have processing status update for doc 1
            const processingUpdate = statusUpdates.find(
                u => u.docId === 1 && u.status === 'processing'
            );
            assert(processingUpdate);
        });

        it('should update status to completed when changes detected', async () => {
            const job = new BatchNormalizationJob({
                paperlessService: mockPaperlessService,
                normalizer: mockNormalizer,
                store: mockStore,
                concurrency: 1
            });

            await job.run({ limit: 1, dryRun: false });

            const status = await mockStore.getStatus(1);
            assert.strictEqual(status.status, 'completed');
        });

        it('should update status to failed on error', async () => {
            const job = new BatchNormalizationJob({
                paperlessService: mockPaperlessService,
                normalizer: mockNormalizer,
                store: mockStore,
                concurrency: 1
            });

            let statusUpdates = [];
            const originalUpdate = mockStore.updatePaperlessMetadata;
            mockStore.updatePaperlessMetadata = async (docId, status, error) => {
                statusUpdates.push({ docId, status, error });
                return originalUpdate(docId, status, error);
            };

            await job.run({ limit: 10, dryRun: false });

            // Doc 4 should have failed status
            const failedUpdate = statusUpdates.find(
                u => u.docId === 4 && u.status === 'failed'
            );
            assert(failedUpdate);
            assert.strictEqual(failedUpdate.error, 'Normalization failed');
        });

        it('should update status to skipped when no changes detected', async () => {
            const job = new BatchNormalizationJob({
                paperlessService: mockPaperlessService,
                normalizer: mockNormalizer,
                store: mockStore,
                concurrency: 1
            });

            let statusUpdates = [];
            const originalUpdate = mockStore.updatePaperlessMetadata;
            mockStore.updatePaperlessMetadata = async (docId, status, error) => {
                statusUpdates.push({ docId, status, error });
                return originalUpdate(docId, status, error);
            };

            await job.run({ limit: 10, dryRun: false });

            // Doc 3 should have skipped status (no changes)
            const skippedUpdate = statusUpdates.find(
                u => u.docId === 3 && u.status === 'skipped'
            );
            assert(skippedUpdate);
        });
    });

    describe('Dry Run Mode', () => {
        it('should not normalize documents in dry-run mode', async () => {
            let normalizeWasCalled = false;
            mockNormalizer.analyzeAndNormalize = async () => {
                normalizeWasCalled = true;
                return { changesDetected: false, actions: [], normalizedPages: null };
            };

            const job = new BatchNormalizationJob({
                paperlessService: mockPaperlessService,
                normalizer: mockNormalizer,
                store: mockStore,
                concurrency: 1
            });

            const result = await job.run({ limit: 10, dryRun: true });

            assert.strictEqual(result.stats.total, 3);
            assert.strictEqual(result.stats.skipped, 3);
            assert.strictEqual(normalizeWasCalled, false);
        });
    });

    describe('Event Emissions', () => {
        it('should emit document events', async () => {
            const job = new BatchNormalizationJob({
                paperlessService: mockPaperlessService,
                normalizer: mockNormalizer,
                store: mockStore,
                concurrency: 1
            });

            const events = [];
            job.on('document:start', (data) => events.push({ type: 'start', data }));
            job.on('document:success', (data) => events.push({ type: 'success', data }));
            job.on('document:failed', (data) => events.push({ type: 'failed', data }));

            await job.run({ limit: 10, dryRun: false });

            // Should have start events for all 3 documents
            const startEvents = events.filter(e => e.type === 'start');
            assert.strictEqual(startEvents.length, 3);

            // Should have success events for docs 1 and 3
            const successEvents = events.filter(e => e.type === 'success');
            assert.strictEqual(successEvents.length, 2);

            // Should have failed event for doc 4
            const failedEvents = events.filter(e => e.type === 'failed');
            assert.strictEqual(failedEvents.length, 1);
            assert.strictEqual(failedEvents[0].data.docId, 4);
        });
    });
});
