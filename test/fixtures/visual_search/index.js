/**
 * Test fixtures for Alpha-9 Visual Search API tests
 *
 * Architecture Reference: ticket:007.1 (Integration Tests)
 */

/**
 * Minimal valid base64 PNG image (1x1 red pixel)
 * Used for testing API contract validation
 */
const MINIMAL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/**
 * Invalid base64 string for testing error handling
 */
const INVALID_BASE64 = 'not-valid-base64!!!';

/**
 * Empty string for testing missing image handling
 */
const EMPTY_IMAGE = '';

/**
 * 320-dimensional dummy vector for Qdrant tests
 * Normalized to unit length
 */
const DUMMY_VECTOR_320 = new Array(320).fill(0.05).map((v, i) => {
    const normalized = Math.sin(i * 0.1) * 0.1;
    return parseFloat(normalized.toFixed(6));
});

/**
 * Test document metadata fixtures
 */
const TEST_DOCUMENTS = [
    {
        id: 99901,
        title: 'Invoice Test Document',
        correspondent_id: 1,
        tag_ids: [1, 3, 7],
        created: '2024-01-15T10:00:00Z'
    },
    {
        id: 99902,
        title: 'Contract Test Document',
        correspondent_id: 2,
        tag_ids: [2, 4],
        created: '2024-01-16T10:00:00Z'
    },
    {
        id: 99903,
        title: 'Receipt Test Document',
        correspondent_id: 1,
        tag_ids: [1, 5],
        created: '2024-01-17T10:00:00Z'
    }
];

/**
 * Expected search response structure
 */
const EXPECTED_SEARCH_RESPONSE = {
    success: true,
    results: expect => expect.toBeArray(),
    collectionUsed: expect => expect.toBeOneOf(['visual_pages', 'visual_overlays']),
    total: expect => expect.toBeNumber()
};

/**
 * Expert Filter test cases
 */
const FILTER_TEST_CASES = [
    {
        name: 'doc_id filter',
        filters: { doc_id: 99901 },
        expectedMatches: [99901]
    },
    {
        name: 'tag_ids filter',
        filters: { tag_ids: [1, 3] },
        expectedMatches: [99901, 99903] // docs with tag 1 or 3
    },
    {
        name: 'correspondent_id filter',
        filters: { correspondent_id: 2 },
        expectedMatches: [99902]
    },
    {
        name: 'combined filters',
        filters: { correspondent_id: 1, tag_ids: [1] },
        expectedMatches: [99901, 99903]
    }
];

/**
 * Error response fixtures
 */
const ERROR_RESPONSES = {
    SIDECAR_INITIALIZING: {
        success: false,
        error: 'Service initializing',
        errorType: 'SIDECAR_INITIALIZING',
        detail: 'Stage: loading_model',
        retryable: true
    },
    TIMEOUT: {
        success: false,
        error: 'Visual search timeout',
        errorType: 'TIMEOUT',
        retryable: true
    },
    CIRCUIT_OPEN: {
        success: false,
        error: 'Visual search service is temporarily unavailable',
        errorType: 'CIRCUIT_OPEN',
        circuit_breaker: 'open',
        retryable: false
    }
};

module.exports = {
    MINIMAL_PNG_BASE64,
    INVALID_BASE64,
    EMPTY_IMAGE,
    DUMMY_VECTOR_320,
    TEST_DOCUMENTS,
    EXPECTED_SEARCH_RESPONSE,
    FILTER_TEST_CASES,
    ERROR_RESPONSES
};
