/**
 * Qdrant Polling Helpers for E2E Tests
 *
 * Provides utilities to verify payload mirroring from Postgres to Qdrant.
 */

const fetch = require('node-fetch');

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'visual_overlays';

/**
 * Get points from Qdrant by document ID filter
 * @param {number|string} docId - Document ID to filter by
 * @param {object} opts - Options
 * @param {number} opts.limit - Max points to return (default 100)
 * @returns {Promise<Array>} - Array of Qdrant points
 */
async function getPointsByDocId(docId, opts = {}) {
  const limit = opts.limit || 100;

  const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter: {
        must: [
          { key: 'doc_id', match: { value: parseInt(docId, 10) } }
        ]
      },
      limit,
      with_payload: true,
      with_vectors: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Qdrant scroll failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.result?.points || [];
}

/**
 * Poll Qdrant for points matching a document ID
 * @param {number|string} docId - Document ID
 * @param {object} opts - Options
 * @param {number} opts.timeoutMs - Max wait time (default 5000)
 * @param {number} opts.intervalMs - Poll interval (default 500)
 * @param {number} opts.minCount - Minimum points expected (default 1)
 * @returns {Promise<Array>} - Array of matching points
 * @throws {Error} - If timeout or no points found
 */
async function pollForQdrantPoints(docId, opts = {}) {
  const { timeoutMs = 5000, intervalMs = 500, minCount = 1 } = opts;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const points = await getPointsByDocId(docId);
      if (points.length >= minCount) {
        return points;
      }
    } catch (err) {
      // Ignore errors during polling, will retry
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for Qdrant points for doc_id=${docId}`);
}

/**
 * Verify payload mirroring between Postgres feedback row and Qdrant point
 * @param {object} pgRow - Postgres feedback_events row
 * @param {object} qdrantPoint - Qdrant point with payload
 * @returns {object} - Verification result { match: boolean, mismatches: string[] }
 */
function verifyPayloadMirroring(pgRow, qdrantPoint) {
  const mismatches = [];
  const payload = qdrantPoint.payload || {};

  // doc_id must match
  if (payload.doc_id !== pgRow.doc_id) {
    mismatches.push(`doc_id: Qdrant=${payload.doc_id}, Postgres=${pgRow.doc_id}`);
  }

  // event_type should be reflected in Qdrant payload metadata if present
  if (pgRow.event_type && payload.metadata?.event_type !== pgRow.event_type) {
    mismatches.push(`event_type: Qdrant=${payload.metadata?.event_type}, Postgres=${pgRow.event_type}`);
  }

  // field_name should match if present
  if (pgRow.field_name && payload.metadata?.field_name !== pgRow.field_name) {
    mismatches.push(`field_name: Qdrant=${payload.metadata?.field_name}, Postgres=${pgRow.field_name}`);
  }

  // tag_ids array should be present if in context
  const pgTagIds = pgRow.context?.tagIds || pgRow.context?.tag_ids;
  const qdTagIds = payload.tag_ids || payload.metadata?.tag_ids;
  if (pgTagIds && JSON.stringify(pgTagIds) !== JSON.stringify(qdTagIds)) {
    mismatches.push(`tag_ids: Qdrant=${JSON.stringify(qdTagIds)}, Postgres=${JSON.stringify(pgTagIds)}`);
  }

  // correspondent_id should match if present
  const pgCorr = pgRow.context?.correspondentId || pgRow.context?.correspondent_id;
  const qdCorr = payload.correspondent_id || payload.metadata?.correspondent_id;
  if (pgCorr != null && qdCorr !== pgCorr) {
    mismatches.push(`correspondent_id: Qdrant=${qdCorr}, Postgres=${pgCorr}`);
  }

  return {
    match: mismatches.length === 0,
    mismatches
  };
}

/**
 * Check if Qdrant collection exists
 * @returns {Promise<boolean>}
 */
async function collectionExists() {
  try {
    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get collection info from Qdrant
 * @returns {Promise<object>}
 */
async function getCollectionInfo() {
  const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
  if (!response.ok) {
    throw new Error(`Failed to get collection info: ${response.status}`);
  }
  return response.json();
}

module.exports = {
  getPointsByDocId,
  pollForQdrantPoints,
  verifyPayloadMirroring,
  collectionExists,
  getCollectionInfo,
  QDRANT_URL,
  COLLECTION_NAME
};
