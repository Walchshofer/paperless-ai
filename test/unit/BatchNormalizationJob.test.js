/**
 * test/unit/BatchNormalizationJob.test.js
 *
 * Unit tests for BatchNormalizationJob class
 */

const assert = require('assert');
const { EventEmitter } = require('events');
const { BatchNormalizationJob } = require('../../services/normalization/BatchNormalizationJob');

describe('BatchNormalizationJob', () => {
    let job;
    let mockPaperlessService;
    let mockNormalizer;
    let mockStore;

    beforeEach(() => {
        // Mock paperless service
        mockPaperlessService = {
            getAllDocuments: async () => []
        };

        // Mock normalizer
        mockNormalizer = {
            analyzeAndNormalize: async () => ({
                changesDetected: false,
                actions: [],
                normalizedPages: null
            })
        };

        // Mock store
        mockStore = {
            getStatus: async () => ({ status: 'pending' }),
            updatePaperlessMetadata: async () => {},
            store: async () => {},
            isNormalized: async () => false
        };

        // Create job instance with mocks
        job = new BatchNormalizationJob({
            paperlessService: mockPaperlessService,
            normalizer: mockNormalizer,
            store: mockStore,
            concurrency: 1,
            batchLimit: 10
        });
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            const defaultJob = new BatchNormalizationJob();
            assert.strictEqual(defaultJob.concurrency, 2);
            assert.strictEqual(defaultJob.batchLimit, 50);
            assert.strictEqual(defaultJob.skipCompleted, true);
            assert.strictEqual(defaultJob.status, 'idle');
        });

        it('should accept custom configuration', () => {
            const customJob = new BatchNormalizationJob({
                concurrency: 5,
                batchLimit: 100,
                skipCompleted: false
            });
            assert.strictEqual(customJob.concurrency, 5);
            assert.strictEqual(customJob.batchLimit, 100);
            assert.strictEqual(customJob.skipCompleted, false);
        });

        it('should extend EventEmitter', () => {
            assert(job instanceof EventEmitter);
        });
    });

    describe('findPendingDocuments', () => {
        it('should return documents with pending status', async () => {
            mockPaperlessService.getAllDocuments = async () => [
                { id: 1, custom_fields: { ai_normalization_status: 'pending' } },
                { id: 2, custom_fields: { ai_normalization_status: 'completed' } },
                { id: 3, custom_fields: {} }
            ];

            const pending = await job.findPendingDocuments(10);
            assert.strictEqual(pending.length, 2);
            assert.strictEqual(pending[0].id, 1);
            assert.strictEqual(pending[1].id, 3);
        });

        it('should return documents with failed status', async () => {
            mockPaperlessService.getAllDocuments = async () => [
                { id: 1, custom_fields: { ai_normalization_status: 'failed' } },
                { id: 2, custom_fields: { ai_normalization_status: 'completed' } }
            ];

            const pending = await job.findPendingDocuments(10);
            assert.strictEqual(pending.length, 1);
            assert.strictEqual(pending[0].id, 1);
        });

        it('should skip documents with processing status', async () => {
            mockPaperlessService.getAllDocuments = async () => [
                { id: 1, custom_fields: { ai_normalization_status: 'processing' } },
                { id: 2, custom_fields: { ai_normalization_status: 'pending' } }
            ];

            const pending = await job.findPendingDocuments(10);
            assert.strictEqual(pending.length, 1);
            assert.strictEqual(pending[0].id, 2);
        });

        it('should respect limit parameter', async () => {
            mockPaperlessService.getAllDocuments = async () => [
                { id: 1, custom_fields: {} },
                { id: 2, custom_fields: {} },
                { id: 3, custom_fields: {} }
            ];

            const pending = await job.findPendingDocuments(2);
            assert.strictEqual(pending.length, 2);
        });

        it('should include completed documents when force is true', async () => {
            mockPaperlessService.getAllDocuments = async () => [
                { id: 1, custom_fields: { ai_normalization_status: 'completed' } },
                { id: 2, custom_fields: { ai_normalization_status: 'pending' } }
            ];

            const pending = await job.findPendingDocuments(10, true);
            assert.strictEqual(pending.length, 2);
        });
    });

    describe('normalizeDocument', () => {
        it('should normalize a document successfully', async () => {
            mockNormalizer.analyzeAndNormalize = async () => ({
                changesDetected: true,
                actions: [{ action: 'rotate', angle: 90 }],
                normalizedPages: [{ pageNumber: 1, buffer: Buffer.from('test') }]
            });

            let storeWasCalled = false;
            mockStore.store = async (docId, pages) => {
                storeWasCalled = true;
                assert.strictEqual(docId, 123);
                assert.strictEqual(pages.length, 1);
            };

            const result = await job.normalizeDocument(123);
            assert.strictEqual(result.changesDetected, true);
            assert.strictEqual(storeWasCalled, true);
        });

        it('should update status to processing before normalization', async () => {
            let statusUpdated = false;
            mockStore.updatePaperlessMetadata = async (docId, status) => {
                if (status === 'processing') {
                    statusUpdated = true;
                }
            };

            await job.normalizeDocument(123);
            assert.strictEqual(statusUpdated, true);
        });

        it('should update status to skipped when no changes detected', async () => {
            mockNormalizer.analyzeAndNormalize = async () => ({
                changesDetected: false,
                actions: [],
                normalizedPages: null
            });

            let statusUpdated = false;
            mockStore.updatePaperlessMetadata = async (docId, status) => {
                if (status === 'skipped') {
                    statusUpdated = true;
                }
            };

            await job.normalizeDocument(123);
            assert.strictEqual(statusUpdated, true);
        });

        it('should update status to failed on error', async () => {
            mockNormalizer.analyzeAndNormalize = async () => {
                throw new Error('Normalization failed');
            };

            let failedStatusUpdated = false;
            mockStore.updatePaperlessMetadata = async (docId, status, error) => {
                if (status === 'failed') {
                    failedStatusUpdated = true;
                    assert.strictEqual(error, 'Normalization failed');
                }
            };

            try {
                await job.normalizeDocument(123);
                assert.fail('Should have thrown error');
            } catch (error) {
                assert.strictEqual(error.message, 'Normalization failed');
                assert.strictEqual(failedStatusUpdated, true);
            }
        });

        it('should skip documents already being processed', async () => {
            mockStore.getStatus = async () => ({ status: 'processing' });

            try {
                await job.normalizeDocument(123);
                assert.fail('Should have thrown error');
            } catch (error) {
                assert.strictEqual(error.message, 'Document is already being processed');
            }
        });
    });

    describe('run', () => {
        it('should process multiple documents', async () => {
            mockPaperlessService.getAllDocuments = async () => [
                { id: 1, title: 'Doc 1', custom_fields: {} },
                { id: 2, title: 'Doc 2', custom_fields: {} }
            ];

            let normalizedDocs = [];
            mockNormalizer.analyzeAndNormalize = async (docId) => {
                normalizedDocs.push(docId);
                return { changesDetected: false, actions: [], normalizedPages: null };
            };

            const result = await job.run({ limit: 2, dryRun: false });
            assert.strictEqual(result.status, 'completed');
            assert.strictEqual(result.stats.total, 2);
            assert.strictEqual(result.stats.processed, 2);
            assert.strictEqual(normalizedDocs.length, 2);
        });

        it('should support dry-run mode', async () => {
            mockPaperlessService.getAllDocuments = async () => [
                { id: 1, title: 'Doc 1', custom_fields: {} },
                { id: 2, title: 'Doc 2', custom_fields: {} }
            ];

            let normalizeWasCalled = false;
            mockNormalizer.analyzeAndNormalize = async () => {
                normalizeWasCalled = true;
                return { changesDetected: false, actions: [], normalizedPages: null };
            };

            const result = await job.run({ limit: 2, dryRun: true });
            assert.strictEqual(result.status, 'completed');
            assert.strictEqual(result.stats.total, 2);
            assert.strictEqual(result.stats.skipped, 2);
            assert.strictEqual(normalizeWasCalled, false);
        });

        it('should handle errors gracefully and continue processing', async () => {
            mockPaperlessService.getAllDocuments = async () => [
                { id: 1, title: 'Doc 1', custom_fields: {} },
                { id: 2, title: 'Doc 2', custom_fields: {} },
                { id: 3, title: 'Doc 3', custom_fields: {} }
            ];

            mockNormalizer.analyzeAndNormalize = async (docId) => {
                if (docId === 2) {
                    throw new Error('Normalization failed for doc 2');
                }
                return { changesDetected: false, actions: [], normalizedPages: null };
            };

            const result = await job.run({ limit: 3, dryRun: false });
            assert.strictEqual(result.status, 'completed');
            assert.strictEqual(result.stats.total, 3);
            assert.strictEqual(result.stats.processed, 3);
            assert.strictEqual(result.stats.succeeded, 2);
            assert.strictEqual(result.stats.failed, 1);
            assert.strictEqual(result.errors.length, 1);
            assert.strictEqual(result.errors[0].docId, 2);
        });

        it('should emit progress events', async () => {
            mockPaperlessService.getAllDocuments = async () => [
                { id: 1, title: 'Doc 1', custom_fields: {} }
            ];

            const events = [];
            job.on('started', (data) => events.push({ type: 'started', data }));
            job.on('progress', (data) => events.push({ type: 'progress', data }));
            job.on('completed', (data) => events.push({ type: 'completed', data }));

            await job.run({ limit: 1, dryRun: false });

            assert(events.some(e => e.type === 'started'));
            assert(events.some(e => e.type === 'progress'));
            assert(events.some(e => e.type === 'completed'));
        });

        it('should not allow multiple concurrent runs', async () => {
            mockPaperlessService.getAllDocuments = async () => [
                { id: 1, title: 'Doc 1', custom_fields: {} }
            ];

            const firstRun = job.run({ limit: 1 });

            try {
                await job.run({ limit: 1 });
                assert.fail('Should have thrown error');
            } catch (error) {
                assert.strictEqual(error.message, 'Job already running');
            }

            await firstRun;
        });

        it('should update job statistics', async () => {
            mockPaperlessService.getAllDocuments = async () => [
                { id: 1, title: 'Doc 1', custom_fields: {} }
            ];

            const result = await job.run({ limit: 1, dryRun: false });

            assert(result.stats.startTime);
            assert(result.stats.endTime);
            assert(result.stats.duration >= 0);
            assert.strictEqual(typeof result.stats.duration, 'number');
        });
    });

    describe('pause/resume/cancel', () => {
        it('should pause a running job', () => {
            job.status = 'running';
            job.pause();
            assert.strictEqual(job.status, 'paused');
        });

        it('should resume a paused job', () => {
            job.status = 'paused';
            job.resume();
            assert.strictEqual(job.status, 'running');
        });

        it('should cancel a running job', () => {
            job.status = 'running';
            job.cancel();
            assert.strictEqual(job.status, 'cancelled');
        });

        it('should emit events on pause/resume/cancel', () => {
            const events = [];
            job.on('paused', () => events.push('paused'));
            job.on('resumed', () => events.push('resumed'));
            job.on('cancelled', () => events.push('cancelled'));

            job.status = 'running';
            job.jobId = 'test-job';

            job.pause();
            job.resume();
            job.cancel();

            assert.deepStrictEqual(events, ['paused', 'resumed', 'cancelled']);
        });
    });

    describe('getStatus', () => {
        it('should return current job status', () => {
            job.jobId = 'test-job';
            job.status = 'running';
            job.stats.total = 10;
            job.stats.processed = 5;

            const status = job.getStatus();
            assert.strictEqual(status.jobId, 'test-job');
            assert.strictEqual(status.status, 'running');
            assert.strictEqual(status.total, 10);
            assert.strictEqual(status.processed, 5);
            assert.strictEqual(status.percentage, 50);
        });
    });
});
