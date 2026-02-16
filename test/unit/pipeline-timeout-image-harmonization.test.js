/**
 * pipeline-timeout-image-harmonization.test.js
 *
 * Tests for:
 * 1. Pipeline timeout configuration values (Subtask 1)
 * 2. Stage 8 image property harmonization with ParallelOcrExecutor (Subtask 2)
 * 3. Debug artifact removal verification (Subtask 3)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

describe('Pipeline Timeout Configuration', function () {
  it('visualOCR timeout defaults to at least 120000ms', function () {
    // Read the raw source to verify the default timeout value
    const configPath = path.resolve(__dirname, '../../config/config.js');
    const source = fs.readFileSync(configPath, 'utf8');
    // The config line: parseInt(process.env.VIS_OCR_TIMEOUT || '120000', 10)
    assert.ok(
      source.includes("VIS_OCR_TIMEOUT || '120000'"),
      'config.js should default VIS_OCR_TIMEOUT to 120000ms'
    );
  });

  it('guidanceService timeout defaults to at least 90000ms', function () {
    const configPath = path.resolve(__dirname, '../../config/config.js');
    const source = fs.readFileSync(configPath, 'utf8');
    assert.ok(
      source.includes("GUIDANCE_TIMEOUT || '90000'"),
      'config.js should default GUIDANCE_TIMEOUT to at least 90000ms'
    );
  });
});

describe('ParallelOcrExecutor default timeouts', function () {
  it('visualOcr soft timeout defaults to 120000ms', function () {
    const { ParallelOcrExecutor } = require('../../services/experts/ParallelOcrExecutor');
    const mockOllamaService = { generate: async () => ({ response: '' }) };
    const executor = new ParallelOcrExecutor(mockOllamaService);
    assert.strictEqual(
      executor.config.visualOcr.timeout,
      120000,
      'visualOcr.timeout should default to 120000ms'
    );
  });

  it('visualOcr hard timeout defaults to 180000ms', function () {
    const { ParallelOcrExecutor } = require('../../services/experts/ParallelOcrExecutor');
    const mockOllamaService = { generate: async () => ({ response: '' }) };
    const executor = new ParallelOcrExecutor(mockOllamaService);
    assert.strictEqual(
      executor.config.visualOcr.hardTimeout,
      180000,
      'visualOcr.hardTimeout should default to 180000ms'
    );
  });

  it('custom timeout overrides still work', function () {
    const { ParallelOcrExecutor } = require('../../services/experts/ParallelOcrExecutor');
    const mockOllamaService = { generate: async () => ({ response: '' }) };
    const executor = new ParallelOcrExecutor(mockOllamaService, {
      visualOcr: { timeout: 5000, hardTimeout: 10000 }
    });
    assert.strictEqual(executor.config.visualOcr.timeout, 5000);
    assert.strictEqual(executor.config.visualOcr.hardTimeout, 10000);
  });
});

describe('Stage 8 image property harmonization', function () {
  it('documentImage resolution checks image_data first in Stage 8', function () {
    // Verify the documentImage assignment in _executeVisualQueryExecutionStage
    // follows the ParallelOcrExecutor._prepareImageForOllama pattern
    const filePath = path.resolve(
      __dirname,
      '../../services/experts/ExpertPipelineExecutor.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');

    // Find the documentImage assignment block (unique comment marks it)
    const markerComment = 'Image property resolution follows ParallelOcrExecutor';
    const blockStart = source.indexOf(markerComment);
    assert.ok(blockStart > 0, 'Should have the ParallelOcrExecutor pattern comment');

    // Extract the block (next ~500 chars after the marker)
    const block = source.substring(blockStart, blockStart + 500);

    // Within this block, image_data must appear before base64Images before imageBase64
    const imageDataIdx = block.indexOf('image_data');
    const base64ImagesIdx = block.indexOf('base64Images');
    const imageBase64Idx = block.indexOf('imageBase64');

    assert.ok(imageDataIdx >= 0, 'Block should check image_data');
    assert.ok(base64ImagesIdx >= 0, 'Block should check base64Images');
    assert.ok(imageBase64Idx >= 0, 'Block should check imageBase64');

    assert.ok(
      imageDataIdx < base64ImagesIdx,
      'image_data should be checked before base64Images'
    );
    assert.ok(
      base64ImagesIdx < imageBase64Idx,
      'base64Images should be checked before imageBase64'
    );
  });

  it('image resolution skips stage when no image properties exist', async function () {
    this.timeout(10000);
    const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');

    // Mock visual search client that is instantly available
    const mockVisualSearchClient = {
      isAvailable: async () => true,
      searchImageAlpha9: async () => ({ results: [] }),
      getCacheStats: () => ({})
    };

    const executor = new ExpertPipelineExecutor({}, {
      enableVisualRag: true,
      enableMetrics: false,
      visualSearchClient: mockVisualSearchClient
    });

    const stageOutputs = new Map();
    stageOutputs.set('extraction', { fields: [] });
    stageOutputs.set('visual_queries', {
      queries: [{ question: 'test', field_target: 'f1' }]
    });

    const skipped = [];
    const context = {
      document: { id: 1, filename: 'test.pdf' /* no image properties */ },
      options: { enableVisualRag: true, orchestration: {} },
      visualSidecarAvailable: true,
      getStageOutput: (key) => stageOutputs.get(key),
      setStageOutput: (key, output) => stageOutputs.set(key, output),
      skipStage: (stageId, reason) => skipped.push({ stageId, reason }),
      addError: () => {},
      skipped
    };

    const stage = { id: 'visual_execution', outputKey: 'visual_execution' };
    const result = await executor._executeVisualQueryExecutionStage(
      stage,
      context,
      Date.now()
    );

    assert.strictEqual(result.status, 'skipped');
    assert.ok(
      skipped.some(s => s.reason === 'no_image'),
      'Should skip with no_image when no image data is available'
    );
  });

  it('image resolution does NOT skip when image_data is present', async function () {
    this.timeout(30000);
    const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');

    // Mock that returns unavailable so we hit text fallback quickly
    const mockVisualSearchClient = {
      isAvailable: async () => false
    };
    const mockRagService = {
      checkStatus: async () => ({ server_up: false })
    };

    const executor = new ExpertPipelineExecutor({}, {
      enableVisualRag: true,
      enableMetrics: false,
      visualSearchClient: mockVisualSearchClient,
      ragService: mockRagService
    });

    const stageOutputs = new Map();
    stageOutputs.set('extraction', { fields: [{ name: 'f1', confidence: 0.8 }] });
    stageOutputs.set('visual_queries', {
      queries: [{ question: 'test', field_target: 'f1' }]
    });

    const skipped = [];
    const context = {
      document: {
        id: 2,
        filename: 'test-image-data.pdf',
        image_data: 'data:image/png;base64,TESTDATA'
      },
      options: { enableVisualRag: true, orchestration: {} },
      visualSidecarAvailable: undefined,
      getStageOutput: (key) => stageOutputs.get(key),
      setStageOutput: (key, output) => stageOutputs.set(key, output),
      skipStage: (stageId, reason) => skipped.push({ stageId, reason }),
      addError: () => {},
      skipped
    };

    const stage = { id: 'visual_execution', outputKey: 'visual_execution' };
    const result = await executor._executeVisualQueryExecutionStage(
      stage,
      context,
      Date.now()
    );

    // Should NOT have skipped with no_image
    const skippedNoImage = skipped.some(s => s.reason === 'no_image');
    assert.strictEqual(
      skippedNoImage,
      false,
      'Should not skip with no_image when image_data is present'
    );
  });

  it('image resolution does NOT skip when base64Images is present', async function () {
    this.timeout(30000);
    const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');

    const mockVisualSearchClient = {
      isAvailable: async () => false
    };
    const mockRagService = {
      checkStatus: async () => ({ server_up: false })
    };

    const executor = new ExpertPipelineExecutor({}, {
      enableVisualRag: true,
      enableMetrics: false,
      visualSearchClient: mockVisualSearchClient,
      ragService: mockRagService
    });

    const stageOutputs = new Map();
    stageOutputs.set('extraction', { fields: [{ name: 'f1', confidence: 0.8 }] });
    stageOutputs.set('visual_queries', {
      queries: [{ question: 'test', field_target: 'f1' }]
    });

    const skipped = [];
    const context = {
      document: {
        id: 3,
        filename: 'test-base64-images.pdf',
        base64Images: ['data:image/png;base64,IMG1']
      },
      options: { enableVisualRag: true, orchestration: {} },
      visualSidecarAvailable: undefined,
      getStageOutput: (key) => stageOutputs.get(key),
      setStageOutput: (key, output) => stageOutputs.set(key, output),
      skipStage: (stageId, reason) => skipped.push({ stageId, reason }),
      addError: () => {},
      skipped
    };

    const stage = { id: 'visual_execution', outputKey: 'visual_execution' };
    const result = await executor._executeVisualQueryExecutionStage(
      stage,
      context,
      Date.now()
    );

    const skippedNoImage = skipped.some(s => s.reason === 'no_image');
    assert.strictEqual(
      skippedNoImage,
      false,
      'Should not skip with no_image when base64Images is present'
    );
  });
});

describe('Debug artifact removal', function () {
  it('ExpertPipelineExecutor processDocument does not contain debug logging', function () {
    const filePath = path.resolve(
      __dirname,
      '../../services/experts/ExpertPipelineExecutor.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    assert.strictEqual(
      source.includes('process_document_debug_input'),
      false,
      'process_document_debug_input logging should be removed from ExpertPipelineExecutor.js'
    );
  });
});
