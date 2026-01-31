
const assert = require('assert');
const { createDocumentProcessor } = require('../../services/integration/DocumentProcessor');

describe('DocumentProcessor Legacy Method Validation', function() {
    it('throws descriptive error when analyzeDocument is missing', async function() {
        // Mock service without analyzeDocument
        class IncompleteMock {
            async chat() { return { message: { content: '{}' } }; }
            async checkStatus() { return { loadedModels: [] }; }
        }

        const dp = createDocumentProcessor(new IncompleteMock());

        await assert.rejects(async () => {
            await dp._processLegacyText({ id: 'doc-1', ocr_text: 'hello' }, {});
        }, (err) => {
            return /analyzeDocument method not found/i.test(err.message);
        });
    });

    it('throws descriptive error when analyzeDocumentWithVision is missing', async function() {
        // Mock service without analyzeDocumentWithVision
        class IncompleteMock2 {
            async chat() { return { message: { content: '{}' } }; }
            async checkStatus() { return { loadedModels: [] }; }
        }

        const dp = createDocumentProcessor(new IncompleteMock2());

        await assert.rejects(async () => {
            await dp._processLegacyVision({ id: 'doc-2', image_data: 'data:' }, {});
        }, (err) => {
            return /analyzeDocumentWithVision method not found/i.test(err.message);
        });
    });
});
