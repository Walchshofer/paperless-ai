/**
 * Test utilities for VisualOverlayRepository integration tests
 */

const { visualOverlayRepository } = require('../../../services/visual-rag-client');
const { TEST_DOC_ID, TEST_DOC_ID_ALT } = require('./fixtures');

/**
 * Wait for database connection to be available
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delayMs - Delay between retries in milliseconds
 * @returns {Promise<boolean>}
 */
async function waitForConnection(maxRetries = 5, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const available = await visualOverlayRepository.isAvailable();
        if (available) {
            return true;
        }
        if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    return false;
}

/**
 * Clean up test data from the database
 * @param {number|number[]} docIds - Document ID(s) to clean up
 */
async function cleanupTestData(docIds = [TEST_DOC_ID, TEST_DOC_ID_ALT]) {
    const ids = Array.isArray(docIds) ? docIds : [docIds];
    for (const docId of ids) {
        try {
            await visualOverlayRepository.deleteByDocId(docId);
        } catch (error) {
            // Ignore errors during cleanup (table might not exist yet, etc.)
        }
    }
}

/**
 * Get the repository instance for testing
 * @returns {VisualOverlayRepository}
 */
function getRepository() {
    return visualOverlayRepository;
}

/**
 * Skip test if database is not available
 */
async function skipIfNoDatabase() {
    const available = await visualOverlayRepository.isAvailable(false);
    if (!available) {
        return 'PostgreSQL not available';
    }
    return null;
}

module.exports = {
    waitForConnection,
    cleanupTestData,
    getRepository,
    skipIfNoDatabase
};
