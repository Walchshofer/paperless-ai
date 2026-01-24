const assert = require('assert');
const { randomUUID } = require('crypto');
const fetch = require('node-fetch');
const { queryDb } = require('../helpers/db-poll');
const {
  verifyPayloadMirroring,
  getPointsByDocId,
  COLLECTION_NAME,
  QDRANT_URL
} = require('../helpers/qdrant-poll');

describe('Payload Mirroring - Alpha-9', function () {
  this.timeout(15000);

  it('verifies payload mirroring logic with simulated Qdrant point', async function () {
    // Insert a feedback row into Postgres (test DB must be available)
    const docId = Math.floor(Date.now() / 1000);

    // Insert row - tolerant to different schemas; only doc_id and event_type are required
    const insertSql = `INSERT INTO feedback_events (doc_id, event_type, context)
      VALUES ($1, $2, $3) RETURNING *`;

    const context = { correspondent_id: 'corr-' + docId };
    const rows = await queryDb(insertSql, [docId, 'visual_match_confirmed', context]);
    const pgRow = rows[0];

    // Simulate Qdrant point upsert that the mirroring pipeline would create
    // Use Qdrant points upsert API
    const pointId = randomUUID();
    const payload = {
      id: pointId,
      vector: new Array(320).fill(0),
      payload: {
        doc_id: pgRow.doc_id,
        correspondent_id: pgRow.context?.correspondent_id || null,
        metadata: {
          event_type: pgRow.event_type
        }
      }
    };

    const qUrl = QDRANT_URL || `http://${process.env.QDRANT_HOST || 'localhost'}:${process.env.QDRANT_PORT || 6333}`;
    let res;
    try {
      res = await fetch(`${qUrl}/collections/${COLLECTION_NAME}/points?wait=true`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: [payload] })
      });
    } catch (err) {
      if (/ECONNREFUSED|ENOTFOUND/i.test(err.message)) {
        this.skip();
        return;
      }
      throw err;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to upsert Qdrant point: ${res.status} ${text}`);
    }

    // Read back points via helper and verify mapping
    const points = await getPointsByDocId(pgRow.doc_id, { limit: 5 });
    assert.ok(points.length > 0, 'Qdrant should return at least one point for the doc_id');

    const match = verifyPayloadMirroring(pgRow, points[0]);
    assert.ok(match.match, `Payload should mirror Postgres row: ${match.mismatches.join(', ')}`);
  });
});