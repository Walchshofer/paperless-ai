/**
 * Test Helpers Index
 *
 * Centralized exports for all E2E test helper utilities.
 * Import from this file for cleaner test code.
 *
 * @example
 * const { pollForFeedbackEvent, snapshotMetrics, pollForQdrantPoints } = require('../helpers');
 */

// Database polling utilities
const {
  pollForFeedbackEvent,
  pollForRow,
  queryDb
} = require('./db-poll');

// Qdrant vector store utilities
const {
  getPointsByDocId,
  pollForQdrantPoints,
  verifyPayloadMirroring,
  collectionExists,
  getCollectionInfo,
  QDRANT_URL,
  COLLECTION_NAME
} = require('./qdrant-poll');

// Prometheus metrics utilities
const { snapshotMetrics } = require('./metrics-snapshot');

// Sidecar mock utilities (if available)
let sidecarMock = {};
try {
  sidecarMock = require('./sidecar-mock');
} catch {
  // sidecar-mock may not exist
}

module.exports = {
  // DB helpers
  pollForFeedbackEvent,
  pollForRow,
  queryDb,

  // Qdrant helpers
  getPointsByDocId,
  pollForQdrantPoints,
  verifyPayloadMirroring,
  collectionExists,
  getCollectionInfo,
  QDRANT_URL,
  COLLECTION_NAME,

  // Metrics helpers
  snapshotMetrics,

  // Sidecar mock (if available)
  ...sidecarMock
};
