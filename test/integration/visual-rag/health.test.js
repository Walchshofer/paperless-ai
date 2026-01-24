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
                const baseUrl = process.env.VISUAL_RAG_URL || `http://${process.env.VISUAL_RAG_HOST || 'visual-rag-sidecar'}:${process.env.VISUAL_RAG_PORT || 8001}`;
                const res = await axios.get(`${baseUrl}/health`, { timeout: 5000 });
                const data = res && res.data ? res.data : null;
                const modelLoaded = data?.model_loaded === true
                    || data?.init?.model_loaded === true;
                if (modelLoaded) {
                    return; // success
                }
                last = data || last;
            } catch (err) {
                const msg = err && (err.message || '');
                // If connection is refused or host not found, skip test early to avoid long timeouts in CI
                if (/ECONNREFUSED|ENOTFOUND/i.test(msg) || err?.code === 'ECONNREFUSED') {
                    this.skip();
                    return;
                }
                last = err.message || err;
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        assert.fail(`Sidecar did not become ready in ${timeoutMs}ms. Last: ${JSON.stringify(last)}`);
    });
});