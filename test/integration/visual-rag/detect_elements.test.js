const axios = require('axios');
const assert = require('assert');

// Tiny 1x1 PNG base64
const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';

describe('Visual RAG sidecar detect_elements (integration)', function() {
    this.timeout(20000);

    it('should return elements payload shape for a valid image', async function() {
        try {
            const res = await axios.post('http://localhost:8001/detect_elements', {
                image: tinyPngBase64,
                detect_types: ['tables', 'images']
            }, { timeout: 10000 });

            assert.strictEqual(res.status, 200);
            assert.ok(res.data);
            assert.ok(Array.isArray(res.data.elements));
            assert.strictEqual(typeof res.data.layout, 'object');
            assert.strictEqual(typeof res.data.confidence, 'number');
        } catch (error) {
            const status = error.response?.status;
            if (status === 404 || status === 503 || error.code === 'ECONNREFUSED') {
                this.skip();
                return;
            }
            throw error;
        }
    });
});
