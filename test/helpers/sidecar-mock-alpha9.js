/**
 * sidecar-mock-alpha9.js
 *
 * Mock server for Alpha-9 Visual RAG Sidecar testing.
 * Supports simulating various states: healthy, 503 initializing, timeout.
 *
 * Architecture Reference: ticket:007.2 (Alpha-9 Fallback Handshake Tests)
 */

const http = require('http');

/**
 * State configurations for the mock sidecar
 */
const MockStates = {
    HEALTHY: 'healthy',
    INITIALIZING: 'initializing',
    TIMEOUT: 'timeout',
    ERROR: 'error'
};

/**
 * Default mock search response
 */
const DEFAULT_SEARCH_RESPONSE = {
    results: [
        {
            doc_id: 1,
            page_num: 1,
            score: 0.8542,
            thumbnail_url: '/api/documents/1/thumb/'
        },
        {
            doc_id: 2,
            page_num: 1,
            score: 0.7234,
            thumbnail_url: '/api/documents/2/thumb/'
        }
    ],
    total_results: 2,
    score_type: 'maxsim',
    collection_used: 'visual_pages',
    execution_time_ms: 42,
    query_type: 'image'
};

/**
 * Start an Alpha-9 compatible sidecar mock
 *
 * @param {number} port - Port to listen on (default: 8001)
 * @param {Object} options - Mock behavior options
 * @param {string} options.state - Initial state (healthy|initializing|timeout|error)
 * @param {string} options.initStage - Initialization stage when in initializing state
 * @param {number} options.timeoutMs - Delay in ms for timeout simulation
 * @param {Object} options.searchResponse - Custom search response
 * @returns {Promise<Object>} Mock server control object
 */
function startAlpha9SidecarMock(port = 8001, options = {}) {
    let currentState = options.state || MockStates.HEALTHY;
    let initStage = options.initStage || 'loading_model';
    const timeoutMs = options.timeoutMs || 10000;
    const searchResponse = options.searchResponse || DEFAULT_SEARCH_RESPONSE;

    const server = http.createServer(async (req, res) => {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        // Propagate X-Request-Id if present
        const requestId = req.headers['x-request-id'];
        if (requestId) {
            res.setHeader('X-Request-Id', requestId);
        }

        // Handle timeout state - delay response indefinitely
        if (currentState === MockStates.TIMEOUT) {
            await new Promise(resolve => setTimeout(resolve, timeoutMs));
            res.statusCode = 200;
            return res.end(JSON.stringify({ results: [] }));
        }

        // Health endpoint
        if (req.url === '/health' && req.method === 'GET') {
            if (currentState === MockStates.INITIALIZING) {
                res.statusCode = 200;
                return res.end(JSON.stringify({
                    status: 'initializing',
                    model_loaded: false,
                    qdrant_connected: false,
                    init_stage: initStage,
                    flash_attn_available: true,
                    flash_attn_version: '2.4.0'
                }));
            }

            if (currentState === MockStates.ERROR) {
                res.statusCode = 500;
                return res.end(JSON.stringify({
                    error: 'Internal server error',
                    detail: 'Model failed to load'
                }));
            }

            res.statusCode = 200;
            return res.end(JSON.stringify({
                status: 'healthy',
                model_loaded: true,
                qdrant_connected: true,
                collections: ['visual_pages', 'visual_overlays'],
                embedding_dim: 320,
                flash_attn_available: true,
                flash_attn_version: '2.4.0'
            }));
        }

        // Search endpoint (Alpha-9 Protocol)
        if (req.url === '/search' && req.method === 'POST') {
            // Handle 503 initializing state
            if (currentState === MockStates.INITIALIZING) {
                res.statusCode = 503;
                return res.end(JSON.stringify({
                    detail: `Service initializing: ${initStage}`,
                    init_stage: initStage,
                    retry_after: 30
                }));
            }

            if (currentState === MockStates.ERROR) {
                res.statusCode = 500;
                return res.end(JSON.stringify({
                    error: 'Internal server error',
                    detail: 'Search failed'
                }));
            }

            // Parse request body
            let body = '';
            for await (const chunk of req) {
                body += chunk;
            }

            try {
                const payload = JSON.parse(body);
                const collection = payload.collection_name || 'visual_pages';
                const k = payload.k || 5;

                // Build response based on collection and filters
                const response = {
                    ...searchResponse,
                    collection_used: collection,
                    results: searchResponse.results.slice(0, k)
                };

                // Apply filters if present (simulate filtering)
                if (payload.filters) {
                    if (payload.filters.doc_id) {
                        response.results = response.results.filter(
                            r => r.doc_id === payload.filters.doc_id
                        );
                    }
                    response.filters_applied = Object.keys(payload.filters);
                }

                res.statusCode = 200;
                return res.end(JSON.stringify(response));

            } catch (parseError) {
                res.statusCode = 400;
                return res.end(JSON.stringify({
                    error: 'Invalid JSON',
                    detail: parseError.message
                }));
            }
        }

        // Status endpoint
        if (req.url === '/status' && req.method === 'GET') {
            res.statusCode = 200;
            return res.end(JSON.stringify({
                indexed_documents: 100,
                total_pages: 500,
                collections: {
                    visual_pages: { count: 500, dim: 320 },
                    visual_overlays: { count: 1200, dim: 320 }
                }
            }));
        }

        // Not found
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(port, () => {
            resolve({
                server,
                port,
                /**
                 * Stop the mock server
                 */
                stop: () => new Promise(res => server.close(res)),
                /**
                 * Set the current state
                 * @param {string} state - New state (healthy|initializing|timeout|error)
                 */
                setState: (state) => { currentState = state; },
                /**
                 * Set initialization stage
                 * @param {string} stage - Stage name
                 */
                setInitStage: (stage) => { initStage = stage; },
                /**
                 * Get current state
                 * @returns {string} Current state
                 */
                getState: () => currentState,
                /**
                 * Simulate state transition from initializing to healthy
                 * @param {number} delayMs - Delay before transitioning
                 */
                simulateWarmup: (delayMs = 2000) => {
                    currentState = MockStates.INITIALIZING;
                    initStage = 'loading_model';
                    setTimeout(() => {
                        initStage = 'connecting_qdrant';
                        setTimeout(() => {
                            initStage = 'validating_dimensions';
                            setTimeout(() => {
                                currentState = MockStates.HEALTHY;
                            }, delayMs / 3);
                        }, delayMs / 3);
                    }, delayMs / 3);
                }
            });
        });
    });
}

module.exports = {
    startAlpha9SidecarMock,
    MockStates,
    DEFAULT_SEARCH_RESPONSE
};
