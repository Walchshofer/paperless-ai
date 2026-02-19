/* eslint-env mocha */
const assert = require('assert');

describe('DocumentProcessor visual-input hard failures', function () {
  const {
    DocumentProcessor,
    ProcessorConfig
  } = require('../../services/integration/DocumentProcessor');

  function createMockOllama() {
    return {
      analyzeDocument: async () => ({}),
      analyzeDocumentWithVision: async () => ({})
    };
  }

  it('does not fallback to legacy text when visual input is missing', async function () {
    const processor = new DocumentProcessor(createMockOllama(), {
      features: {
        enableFallbackToLegacy: true
      }
    });

    let fallbackCalled = false;
    processor._processExpertPipeline = async () => {
      const error = new Error('No PNG page image available');
      error.code = 'VISUAL_INPUT_MISSING';
      throw error;
    };
    processor._processLegacyText = async () => {
      fallbackCalled = true;
      return { pipeline_id: 'legacy_text' };
    };

    const result = await processor.process(
      { id: 1001, filename: 'missing-image.pdf' },
      { mode: ProcessorConfig.modes.EXPERT_PIPELINE }
    );

    assert.strictEqual(fallbackCalled, false);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, 'VISUAL_INPUT_MISSING');
    assert.strictEqual(result.metadata.errorCode, 'VISUAL_INPUT_MISSING');
  });

  it('still falls back for non-visual processing errors when enabled', async function () {
    const processor = new DocumentProcessor(createMockOllama(), {
      features: {
        enableFallbackToLegacy: true
      }
    });

    processor._processExpertPipeline = async () => {
      throw new Error('Transient expert pipeline failure');
    };
    processor._processLegacyText = async () => ({
      pipeline_id: 'legacy_text',
      confidence: 0.4
    });

    const result = await processor.process(
      { id: 1002, filename: 'fallback-ok.pdf' },
      { mode: ProcessorConfig.modes.EXPERT_PIPELINE }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.metadata.processingMode, 'fallback_text');
  });
});
