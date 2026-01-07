// test/feedback_persistence.test.js
const assert = require('assert');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const feedbackService = require('../services/feedback/FeedbackService');

// Config from environment or defaults
const config = {
    host: process.env.POSTGRES_HOST || process.env.PAPERLESS_DBHOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'paperless',
    user: process.env.POSTGRES_USER || process.env.PAPERLESS_DBUSER,
    password: process.env.POSTGRES_PASSWORD || process.env.PAPERLESS_DBPASS,
};

describe('Feedback Persistence (PostgreSQL)', function() {
    let pool;

    before(async function() {
        if (!config.user || !config.password) {
            console.log('Skipping PG tests: Missing credentials');
            this.skip();
        }
        pool = new Pool(config);
        try {
            await pool.query('SELECT 1');
        } catch (e) {
            console.log('Skipping PG tests: Database not accessible');
            this.skip();
        }

        // Apply migration
        try {
            const migrationSql = fs.readFileSync(path.join(__dirname, '../migrations/002_create_feedback_events.sql'), 'utf8');
            await pool.query(migrationSql);
        } catch (e) {
            console.error('Migration failed:', e.message);
            throw e;
        }
    });

    after(async function() {
        if (pool) {
            // Apply rollback
            try {
                const rollbackSql = fs.readFileSync(path.join(__dirname, '../migrations/002_rollback_feedback_events.sql'), 'utf8');
                await pool.query(rollbackSql);
            } catch (e) {
                console.error('Rollback failed:', e.message);
            }
            await pool.end();
        }
    });

    it('should insert granular feedback and visual overlays in a transaction', async function() {
        const docId = 999999; // Test ID
        const feedbackEvents = [
            {
                type: 'correction',
                field: 'total',
                original: '100.00',
                corrected: '120.00',
                user_id: 1
            },
            {
                type: 'annotation',
                field: 'signature',
                bbox: [100, 100, 200, 200],
                page: 1,
                context: { comment: 'Missing signature' }
            }
        ];

        const result = await feedbackService.recordGranularFeedback(docId, feedbackEvents, { transactional: true });
        
        assert.strictEqual(result.inserted.length, 1, 'Should have inserted 1 feedback event');
        assert.strictEqual(result.overlays.length, 1, 'Should have inserted 1 overlay');

        // Verify DB content
        const eventRes = await pool.query('SELECT * FROM feedback_events WHERE doc_id = $1', [docId]);
        assert.strictEqual(eventRes.rows.length, 1);
        assert.strictEqual(eventRes.rows[0].event_type, 'correction');
        assert.strictEqual(eventRes.rows[0].field_name, 'total');

        const overlayRes = await pool.query("SELECT * FROM visual_overlays WHERE doc_id = $1 AND source = 'manual'", [docId]);
        assert.strictEqual(overlayRes.rows.length, 1);
        // bbox stored as JSONB, pg returns it as object
        assert.deepStrictEqual(overlayRes.rows[0].bbox, [100, 100, 200, 200]);
    });

    it('should rollback transaction on error', async function() {
        const docId = 888888;
        // Pass event with NULL type to violate NOT NULL constraint
        try {
            await feedbackService.recordGranularFeedback(docId, [{ type: null }], { transactional: true });
            assert.fail('Should have thrown error');
        } catch (e) {
            assert.ok(e.message);
        }

        // Verify nothing inserted
        const eventRes = await pool.query('SELECT * FROM feedback_events WHERE doc_id = $1', [docId]);
        assert.strictEqual(eventRes.rows.length, 0);
    });

  it('transactional annotation + event should not create duplicate feedback_event', async function() {
    const docId = 424242;
    // Clean up any rows that may exist from prior runs
    await pool.query('DELETE FROM visual_overlays WHERE doc_id = $1', [docId]);
    await pool.query('DELETE FROM feedback_events WHERE doc_id = $1', [docId]);

    const events = [
      { type: 'annotation', field: 'handwritten_note', bbox: [100,100,200,200], page: 1 },
      { type: 'correction', field: 'title', original: 'old', corrected: 'new', user_id: 1 }
    ];

    const result = await feedbackService.recordGranularFeedback(docId, events, { transactional: true });
    assert.ok(!result.failed, 'recordGranularFeedback should succeed');

    const overlayRes = await pool.query("SELECT * FROM visual_overlays WHERE doc_id = $1", [docId]);
    assert.strictEqual(overlayRes.rows.length, 1, 'expected exactly 1 overlay');

    const eventRes = await pool.query('SELECT * FROM feedback_events WHERE doc_id = $1', [docId]);
    assert.strictEqual(eventRes.rows.length, 1, 'expected exactly 1 feedback_event');

  });
});

// Additional tests for embedding persistence and rollback
it('should store embedding on manual annotation and rollback on transactional error', async function() {
    // Guard: skip this standalone PG test if credentials are not provided
    const user = process.env.PGUSER || process.env.PGUSER || process.env.POSTGRES_USER || process.env.POSTGRES_USER;
    const pass = process.env.PGPASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD;
    if (!user || !pass) {
        console.log('Skipping standalone PG test: missing credentials (set PGUSER/PGPASSWORD or POSTGRES_USER/POSTGRES_PASSWORD)');
        this.skip();
    }

    const { Pool } = require('pg');
    const pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: process.env.PGPORT || 5432,
        user: process.env.PGUSER || process.env.PGUSER || process.env.POSTGRES_USER || 'test',
        password: process.env.PGPASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || 'test',
        database: process.env.PGDATABASE || process.env.PGDATABASE || process.env.POSTGRES_DB || 'paperless_test'
    });

    // Quick connectivity check, skip if DB not accessible
    try {
        await pool.query('SELECT 1');
    } catch (e) {
        console.log('Skipping standalone PG test: DB not accessible -', e.message);
        await pool.end().catch(() => {});
        this.skip();
    }

    // Ensure migration applied for this standalone test (may have been rolled back by earlier hooks)
    try {
        const migrationSql = fs.readFileSync(path.join(__dirname, '../migrations/002_create_feedback_events.sql'), 'utf8');
        await pool.query(migrationSql);
    } catch (e) {
        console.error('Standalone test migration failed:', e.message);
        await pool.end().catch(() => {});
        throw e;
    }

    const feedbackService = require('../services/feedback/FeedbackService');

    // Clean up existing rows for test doc
    const docId = Math.floor(Math.random() * 100000) + 1000;
    await pool.query('DELETE FROM visual_overlays WHERE doc_id = $1', [docId]);
    await pool.query('DELETE FROM feedback_events WHERE doc_id = $1', [docId]);

    // 1) Successful insert with embedding
    const events = [{
        type: 'annotation',
        context: { bbox: [100, 100, 200, 200], page: 1 },
        field: 'handwritten_note',
        user_id: 1
    }];

    const res = await feedbackService.recordGranularFeedback(docId, events, { requestId: 'test-1', pool });
    assert.ok(res.inserted.length >= 1, 'expected at least one feedback_event inserted');

    const overlayRes = await pool.query("SELECT * FROM visual_overlays WHERE doc_id = $1 AND source = 'manual'", [docId]);
    assert.ok(overlayRes.rows.length >= 1, 'expected overlay row inserted');
    assert.ok(overlayRes.rows[0].bbox, 'bbox should be present');
    assert.ok(overlayRes.rows[0].embedding !== null && overlayRes.rows[0].embedding !== undefined, 'embedding should be stored');

    // 2) Transactional failure should rollback both tables
    await pool.query('DELETE FROM visual_overlays WHERE doc_id = $1', [docId]);
    await pool.query('DELETE FROM feedback_events WHERE doc_id = $1', [docId]);

    // Provide a malformed event to trigger validation error (annotation missing bbox format)
    let threw = false;
    try {
        await feedbackService.recordGranularFeedback(docId, [{ type: 'annotation', context: { bbox: [1,2] } }], { transactional: true, pool });
    } catch (e) {
        threw = true;
    }
    assert.strictEqual(threw, true, 'expected transactional call to throw on invalid input');

    const eventRes = await pool.query('SELECT * FROM feedback_events WHERE doc_id = $1', [docId]);
    const overlayRes2 = await pool.query("SELECT * FROM visual_overlays WHERE doc_id = $1", [docId]);

    assert.strictEqual(eventRes.rows.length, 0, 'no feedback_events should be present after rollback');
    assert.strictEqual(overlayRes2.rows.length, 0, 'no visual_overlays should be present after rollback');

    await pool.end();
});
