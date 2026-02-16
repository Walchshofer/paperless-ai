/* eslint-env mocha */

/**
 * Feedback Persistence Integration Tests
 *
 * Service dependencies:
 *   - PostgreSQL (POSTGRES_HOST / POSTGRES_DB / credentials)
 *   - Qdrant (QDRANT_HOST / QDRANT_PORT)
 *   - paperless-ai server (app, started in-process)
 *
 * Running modes:
 *   - Container-native: QDRANT_HOST=qdrant + POSTGRES_HOST=db
 *   - Host-side: QDRANT_HOST=localhost + POSTGRES_HOST=localhost
 *   - Skipped automatically: when QDRANT_HOST is absent and RUN_QDRANT_TESTS
 *     is not set (see before hook below).
 */

const assert = require('assert');
const request = require('supertest');
const { Pool } = require('pg');
const app = require('../../server');
const { QdrantAdapter } = require('../../services/visual-rag-client/QdrantAdapter');

describe('Feedback Persistence Integration', function () {
    this.timeout(30000);

    const docId = Math.floor(Date.now() / 1000); // use smaller integer to fit into DB integer columns
    let pool;
    let adapter;

    before(async function () {
        // Bounded timeout: pool connection probe (5s) + Qdrant init headroom
        this.timeout(15000);

        // Skip if QDRANT_HOST not set (CI without Qdrant)
        if (!process.env.QDRANT_HOST && !process.env.RUN_QDRANT_TESTS) {
            this.skip();
            return;
        }

        // DB pool for test validations — use bounded connection timeout so the
        // test skips cleanly instead of hanging when paperless_db is not reachable
        pool = new Pool({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
            database: process.env.POSTGRES_DB || 'paperless',
            user: process.env.POSTGRES_USER || process.env.PAPERLESS_DBUSER,
            password: process.env.POSTGRES_PASSWORD || process.env.PAPERLESS_DBPASS,
            connectionTimeoutMillis: 5000,
            max: 3
        });

        // Verify pool connectivity before proceeding
        try {
            const probeClient = await pool.connect();
            probeClient.release();
        } catch (err) {
            console.log('[feedback-persistence] Skipping: DB not reachable -', err.message);
            await pool.end().catch(() => {});
            pool = null;
            this.skip();
            return;
        }

        adapter = new QdrantAdapter({
            host: process.env.QDRANT_HOST || 'localhost',
            port: parseInt(process.env.QDRANT_PORT, 10) || 6333
        });

        try {
            await adapter.initialize();
        } catch (err) {
            console.log('[feedback-persistence] Skipping: Qdrant init failed -', err.message);
            this.skip();
            return;
        }
    });

    after(async function () {
        if (pool) await pool.end();
    });

    it('should record feedback in Postgres and mirror payload to Qdrant', async function () {
        const events = [
            {
                type: 'annotation',
                field: 'label',
                bbox: [10, 20, 50, 60],
                context: {
                    correspondent_id: 999,
                    tag_ids: [7],
                    page: 1
                }
            }
        ];

        const requestId = `test-${Date.now()}`;
        const resp = await request(app).post('/api/visual-rag/feedback').set('x-request-id', requestId).send({ documentId: docId, events }).expect(200);
        assert.strictEqual(resp.body.success, true);

        // Allow some time for Qdrant upsert to settle
        await new Promise(res => setTimeout(res, 800));

        // Verify a feedback_event exists for this doc_id
        const feRes = await pool.query('SELECT * FROM feedback_events WHERE doc_id = $1 ORDER BY created_at DESC LIMIT 1', [docId]);
        assert.ok(feRes.rows.length > 0, 'feedback_event should exist');
        const fe = feRes.rows[0];
        assert.ok(fe.event_type === 'correction' || fe.event_type === 'annotation' || fe.event_type === 'deferred_ingest');

        // Verify visual_overlay exists and has vector_id
        const voRes = await pool.query('SELECT * FROM visual_overlays WHERE doc_id = $1 ORDER BY id DESC LIMIT 1', [docId]);
        assert.ok(voRes.rows.length > 0, 'visual_overlay should exist');
        const vo = voRes.rows[0];
        assert.ok(vo.vector_id, 'visual_overlay.vector_id should be set');

        // Retrieve from Qdrant by vector_id and check payload mirroring
        const point = await adapter.getPoint('visual_overlays', vo.vector_id);
        assert.ok(point, 'qdrant point should exist');
        assert.strictEqual(point.payload.correspondent_id, 999);
        assert.ok(Array.isArray(point.payload.tag_ids) && point.payload.tag_ids.includes(7));

        // Cleanup: remove Qdrant point
        await adapter.deleteVisualOverlaysByDocId(docId);
        await pool.query('DELETE FROM feedback_events WHERE doc_id = $1', [docId]);
        await pool.query('DELETE FROM visual_overlays WHERE doc_id = $1', [docId]);
    });
});
