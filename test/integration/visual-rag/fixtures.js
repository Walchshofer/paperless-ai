/**
 * Test fixtures for VisualOverlayRepository tests
 */

// Use a high doc ID unlikely to conflict with real documents
const TEST_DOC_ID = 999999;
const TEST_DOC_ID_ALT = 999998;

// Sample overlay data matching the expected format
const SAMPLE_OVERLAYS = [
    {
        pageNumber: 1,
        overlayData: {
            label: 'signature',
            box: [100, 100, 200, 200],
            confidence: 0.95
        },
        semanticLabel: 'signature'
    },
    {
        pageNumber: 1,
        overlayData: {
            label: 'date',
            box: [300, 50, 400, 80],
            confidence: 0.88
        },
        semanticLabel: 'date'
    },
    {
        pageNumber: 2,
        overlayData: {
            label: 'total',
            box: [450, 700, 550, 730],
            confidence: 0.92,
            value: '1,234.56'
        },
        semanticLabel: 'total'
    },
    {
        pageNumber: 2,
        overlayData: {
            label: 'address',
            box: [50, 100, 300, 180],
            confidence: 0.85
        },
        semanticLabel: 'address'
    }
];

/**
 * Factory function to create test overlay with overrides
 */
function createOverlay(overrides = {}) {
    return {
        pageNumber: overrides.pageNumber || 1,
        overlayData: {
            label: overrides.label || 'test-label',
            box: overrides.box || [0, 0, 100, 100],
            confidence: overrides.confidence || 0.9,
            ...overrides.overlayData
        },
        semanticLabel: overrides.semanticLabel || overrides.label || 'test-label'
    };
}

/**
 * Create a batch of overlays for testing
 */
function createOverlayBatch(count, pageNumber = 1) {
    return Array.from({ length: count }, (_, i) => createOverlay({
        pageNumber,
        label: `test-label-${i}`,
        box: [i * 10, i * 10, i * 10 + 50, i * 10 + 50],
        confidence: 0.8 + (i * 0.01)
    }));
}

module.exports = {
    TEST_DOC_ID,
    TEST_DOC_ID_ALT,
    SAMPLE_OVERLAYS,
    createOverlay,
    createOverlayBatch
};
