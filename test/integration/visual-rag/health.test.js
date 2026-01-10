const axios = require('axios');
const assert = require('assert');

describe('Visual RAG sidecar health (integration)', function() {
    this.timeout(120000); // allow extra time for first-run downloads in CI

    it('should report model_loaded:true within timeout', async function() {
        const start = Date.now();
        const timeoutMs = 90000; // 90s
        let last = null;

        while (Date.now() - start < timeoutMs) {
            try {
                const res = await axios.get('http://localhost:8001/health', { timeout: 5000 });
                if (res && res.data && res.data.model_loaded === true) {
                    return; // success
                }
                last = res && res.data ? res.data : last;
            } catch (err) {
                last = err.message;
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        assert.fail(`Sidecar did not become ready in ${timeoutMs}ms. Last: ${JSON.stringify(last)}`);
    });
});