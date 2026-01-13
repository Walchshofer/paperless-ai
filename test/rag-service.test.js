const assert = require('assert');
const axios = require('axios');

describe('RAG Service Integration', function() {
    // Skip if RAG service is not enabled
    if (process.env.RAG_SERVICE_ENABLED !== 'true') {
        console.log('Skipping RAG integration tests (RAG_SERVICE_ENABLED != true)');
        return;
    }

    const ragUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

    it('should be reachable at the configured URL', async function() {
        try {
            // Attempt to hit the health or root endpoint of the RAG service
            // Adjust the endpoint path based on your actual RAG service API
            const response = await axios.get(`${ragUrl}/health`, {
                timeout: 5000, // 5s timeout
                validateStatus: function (status) {
                    return status >= 200 && status < 500; // Accept any response that indicates the server is up
                }
            });
            
            assert.ok(response.status, 'Response should have a status code');
            console.log(`RAG Service reachable at ${ragUrl} (Status: ${response.status})`);
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                assert.fail(`RAG Service not reachable at ${ragUrl}. Is it running?`);
            }
            throw error;
        }
    });
});