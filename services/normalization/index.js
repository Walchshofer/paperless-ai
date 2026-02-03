/**
 * services/normalization/index.js
 *
 * Entry point for normalization services.
 * Exports NormalizationStore and related utilities.
 */

const {
  NormalizationStore,
  NORMALIZATION_STATUS,
  FIELD_NAMES
} = require('./NormalizationStore');

// Create a default singleton instance for convenience
let defaultInstance = null;

/**
 * Get the default NormalizationStore instance
 * @returns {NormalizationStore}
 */
function getDefaultStore() {
  if (!defaultInstance) {
    defaultInstance = new NormalizationStore();
  }
  return defaultInstance;
}

/**
 * Reset the default instance (mainly for testing)
 */
function resetDefaultStore() {
  defaultInstance = null;
}

module.exports = {
  NormalizationStore,
  NORMALIZATION_STATUS,
  FIELD_NAMES,
  getDefaultStore,
  resetDefaultStore
};
