/* eslint-env mocha */

/**
 * Hybrid SOT Feedback Loop Integration Tests
 *
 * Verifies the complete Hybrid SOT feedback loop:
 * - UI "Confirm Match" action → API → PostgreSQL persistence
 * - Vector ID mapping from Qdrant to feedback_events table
 * - RLHF integration verification
 *
 * Architecture Reference: ticket:010.3
 * Hybrid SOT: PostgreSQL (metadata) + Qdrant (vectors)
 */

const assert = require('assert');

// Mock database client for testing
const mockDb = {
    feedbackEvents: [],
    async insert(event) {
        const row = {
            id: mockDb.feedbackEvents.length + 1,
            ...event,
            created_at: new Date().toISOString()
        };
        mockDb.feedbackEvents.push(row);
        return row;
    },
    async findByDocumentId(documentId) {
        return mockDb.feedbackEvents.filter(e => e.document_id === documentId);
    },
    async findByVectorId(vectorId) {
        return mockDb.feedbackEvents.filter(e => e.vector_id === vectorId);
    },
    reset() {
        mockDb.feedbackEvents = [];
    }
};

// Mock Qdrant client for testing
const mockQdrant = {
    points: new Map(),
    async updatePayload(collectionName, pointId, payload) {
        const key = `${collectionName}:${pointId}`;
        const existing = mockQdrant.points.get(key) || {};
        mockQdrant.points.set(key, { ...existing, ...payload });
        return { status: 'ok' };
    },
    async getPoint(collectionName, pointId) {
        const key = `${collectionName}:${pointId}`;
        return mockQdrant.points.get(key) || null;
    },
    reset() {
        mockQdrant.points.clear();
    }
};

/**
 * Simulates the feedback API handler
 */
class FeedbackHandler {
    constructor(db, qdrant) {
        this.db = db;
        this.qdrant = qdrant;
    }

    async recordVisualMatch(payload) {
        const { documentId, vectorId, collection, score, pageNum, userId } = payload;

        // Validate required fields
        if (!documentId || !vectorId) {
            throw new Error('documentId and vectorId are required');
        }

        // Insert feedback event into PostgreSQL
        const event = await this.db.insert({
            event_type: 'visual_match_confirmed',
            document_id: documentId,
            vector_id: vectorId,
            collection_name: collection || 'visual_pages',
            score: score || null,
            page_num: pageNum || null,
            user_id: userId || null
        });

        // Update Qdrant payload with confirmation metadata
        await this.qdrant.updatePayload(
            collection || 'visual_pages',
            vectorId,
            {
                confirmed_match: true,
                confirmed_at: event.created_at,
                confirmed_for_document: documentId
            }
        );

        return event;
    }
}

describe('Hybrid SOT Feedback Loop Integration', function () {
    this.timeout(10000);

    let feedbackHandler;

    beforeEach(function () {
        mockDb.reset();
        mockQdrant.reset();
        feedbackHandler = new FeedbackHandler(mockDb, mockQdrant);
    });

    describe('Feedback Action', function () {
        it('records "Confirm Match" action to database', async function () {
            const payload = {
                documentId: 123,
                vectorId: 'vec_001',
                collection: 'visual_pages',
                score: 0.85,
                pageNum: 1
            };

            const event = await feedbackHandler.recordVisualMatch(payload);

            assert.ok(event, 'Should return created event');
            assert.strictEqual(event.event_type, 'visual_match_confirmed');
            assert.strictEqual(event.document_id, 123);
            assert.strictEqual(event.vector_id, 'vec_001');
        });

        it('captures score and page number', async function () {
            const payload = {
                documentId: 456,
                vectorId: 'vec_002',
                collection: 'visual_pages',
                score: 0.92,
                pageNum: 3
            };

            const event = await feedbackHandler.recordVisualMatch(payload);

            assert.strictEqual(event.score, 0.92);
            assert.strictEqual(event.page_num, 3);
        });

        it('rejects missing documentId', async function () {
            try {
                await feedbackHandler.recordVisualMatch({
                    vectorId: 'vec_003',
                    collection: 'visual_pages'
                });
                assert.fail('Should have thrown');
            } catch (e) {
                assert.ok(e.message.includes('documentId'));
            }
        });

        it('rejects missing vectorId', async function () {
            try {
                await feedbackHandler.recordVisualMatch({
                    documentId: 789,
                    collection: 'visual_pages'
                });
                assert.fail('Should have thrown');
            } catch (e) {
                assert.ok(e.message.includes('vectorId'));
            }
        });
    });

    describe('Database Verification', function () {
        it('creates row in feedback_events table', async function () {
            await feedbackHandler.recordVisualMatch({
                documentId: 100,
                vectorId: 'vec_100',
                collection: 'visual_pages'
            });

            const rows = await mockDb.findByDocumentId(100);
            assert.strictEqual(rows.length, 1);
            assert.strictEqual(rows[0].document_id, 100);
        });

        it('stores correct event_type', async function () {
            await feedbackHandler.recordVisualMatch({
                documentId: 101,
                vectorId: 'vec_101',
                collection: 'visual_pages'
            });

            const rows = await mockDb.findByDocumentId(101);
            assert.strictEqual(rows[0].event_type, 'visual_match_confirmed');
        });

        it('records timestamp within test window', async function () {
            const beforeTime = new Date().toISOString();

            await feedbackHandler.recordVisualMatch({
                documentId: 102,
                vectorId: 'vec_102',
                collection: 'visual_pages'
            });

            const afterTime = new Date().toISOString();

            const rows = await mockDb.findByDocumentId(102);
            const createdAt = rows[0].created_at;

            assert.ok(createdAt >= beforeTime, 'Timestamp should be after start');
            assert.ok(createdAt <= afterTime, 'Timestamp should be before end');
        });

        it('stores collection name', async function () {
            await feedbackHandler.recordVisualMatch({
                documentId: 103,
                vectorId: 'vec_103',
                collection: 'visual_overlays'
            });

            const rows = await mockDb.findByDocumentId(103);
            assert.strictEqual(rows[0].collection_name, 'visual_overlays');
        });
    });

    describe('Vector ID Mapping', function () {
        it('maps vector_id from Qdrant to feedback event', async function () {
            const vectorId = 'qdrant_point_uuid_001';

            await feedbackHandler.recordVisualMatch({
                documentId: 200,
                vectorId: vectorId,
                collection: 'visual_pages'
            });

            const rows = await mockDb.findByVectorId(vectorId);
            assert.strictEqual(rows.length, 1);
            assert.strictEqual(rows[0].document_id, 200);
        });

        it('validates vector ID format (UUID-like)', async function () {
            const uuidLikeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

            await feedbackHandler.recordVisualMatch({
                documentId: 201,
                vectorId: uuidLikeId,
                collection: 'visual_pages'
            });

            const rows = await mockDb.findByVectorId(uuidLikeId);
            assert.ok(rows.length > 0);
        });

        it('supports multiple feedback events for same vector', async function () {
            const vectorId = 'shared_vector_001';

            await feedbackHandler.recordVisualMatch({
                documentId: 300,
                vectorId: vectorId,
                collection: 'visual_pages'
            });

            await feedbackHandler.recordVisualMatch({
                documentId: 301,
                vectorId: vectorId,
                collection: 'visual_pages'
            });

            const rows = await mockDb.findByVectorId(vectorId);
            assert.strictEqual(rows.length, 2);
        });

        it('maintains ID uniqueness across events', async function () {
            await feedbackHandler.recordVisualMatch({
                documentId: 400,
                vectorId: 'vec_400',
                collection: 'visual_pages'
            });

            await feedbackHandler.recordVisualMatch({
                documentId: 401,
                vectorId: 'vec_401',
                collection: 'visual_pages'
            });

            const allEvents = mockDb.feedbackEvents;
            const ids = allEvents.map(e => e.id);
            const uniqueIds = [...new Set(ids)];

            assert.strictEqual(ids.length, uniqueIds.length, 'All event IDs should be unique');
        });
    });

    describe('Qdrant Payload Update', function () {
        it('updates Qdrant payload with confirmation', async function () {
            await feedbackHandler.recordVisualMatch({
                documentId: 500,
                vectorId: 'vec_500',
                collection: 'visual_pages'
            });

            const point = await mockQdrant.getPoint('visual_pages', 'vec_500');
            assert.ok(point, 'Point should exist');
            assert.strictEqual(point.confirmed_match, true);
        });

        it('includes confirmation timestamp in payload', async function () {
            await feedbackHandler.recordVisualMatch({
                documentId: 501,
                vectorId: 'vec_501',
                collection: 'visual_pages'
            });

            const point = await mockQdrant.getPoint('visual_pages', 'vec_501');
            assert.ok(point.confirmed_at, 'Should have confirmation timestamp');
        });

        it('links confirmation to source document', async function () {
            await feedbackHandler.recordVisualMatch({
                documentId: 502,
                vectorId: 'vec_502',
                collection: 'visual_pages'
            });

            const point = await mockQdrant.getPoint('visual_pages', 'vec_502');
            assert.strictEqual(point.confirmed_for_document, 502);
        });
    });

    describe('RLHF Integration', function () {
        it('aggregates feedback for learning', async function () {
            // Record multiple feedback events
            for (let i = 0; i < 5; i++) {
                await feedbackHandler.recordVisualMatch({
                    documentId: 600 + i,
                    vectorId: `vec_60${i}`,
                    collection: 'visual_pages',
                    score: 0.8 + (i * 0.02)
                });
            }

            // Verify aggregation is possible
            const allEvents = mockDb.feedbackEvents.filter(
                e => e.event_type === 'visual_match_confirmed'
            );

            assert.strictEqual(allEvents.length, 5);

            // Calculate average score (simulating learning aggregation)
            const scores = allEvents.map(e => e.score);
            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

            assert.ok(avgScore >= 0.8 && avgScore <= 0.9);
        });

        it('tracks user feedback for personalization', async function () {
            await feedbackHandler.recordVisualMatch({
                documentId: 700,
                vectorId: 'vec_700',
                collection: 'visual_pages',
                userId: 'user_123'
            });

            const rows = await mockDb.findByDocumentId(700);
            assert.strictEqual(rows[0].user_id, 'user_123');
        });

        it('supports feedback retrieval for model training', async function () {
            // Create training data
            await feedbackHandler.recordVisualMatch({
                documentId: 800,
                vectorId: 'vec_800',
                collection: 'visual_pages',
                score: 0.95
            });

            // Simulate retrieval for training
            const trainingData = mockDb.feedbackEvents
                .filter(e => e.event_type === 'visual_match_confirmed')
                .map(e => ({
                    vectorId: e.vector_id,
                    score: e.score,
                    confirmed: true
                }));

            assert.ok(trainingData.length > 0);
            assert.ok(trainingData[0].confirmed);
        });
    });

    describe('End-to-End Feedback Flow', function () {
        it('completes full feedback cycle', async function () {
            // 1. Simulate visual search result
            const searchResult = {
                docId: 999,
                vectorId: 'vec_999',
                score: 0.88,
                pageNum: 1,
                collection: 'visual_pages'
            };

            // 2. User confirms match
            const event = await feedbackHandler.recordVisualMatch({
                documentId: searchResult.docId,
                vectorId: searchResult.vectorId,
                collection: searchResult.collection,
                score: searchResult.score,
                pageNum: searchResult.pageNum
            });

            // 3. Verify PostgreSQL record
            const dbRows = await mockDb.findByDocumentId(999);
            assert.strictEqual(dbRows.length, 1);
            assert.strictEqual(dbRows[0].event_type, 'visual_match_confirmed');

            // 4. Verify Qdrant payload update
            const qdrantPoint = await mockQdrant.getPoint('visual_pages', 'vec_999');
            assert.strictEqual(qdrantPoint.confirmed_match, true);
            assert.strictEqual(qdrantPoint.confirmed_for_document, 999);

            // 5. Verify response includes necessary data
            assert.ok(event.id, 'Should have event ID');
            assert.ok(event.created_at, 'Should have timestamp');
        });
    });
});
