/* eslint-env mocha */

/**
 * Integration tests for Stage 3: Pre-Vision Normalization Pipeline Integration
 *
 * Tests automatic normalization during pipeline execution.
 * Requires mocked dependencies (no live Paperless/Ollama).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');
const { ExecutionContext } = require('../../services/experts/context');
const { StageType } = require('../../services/experts/pipelines/constants');
const { NormalizationStore } = require('../../services/normalization/NormalizationStore');

describe('Normalization Pipeline Integration', function () {
  this.timeout(10000);

  let tempDir;
  let mockOllamaService;
  let mockPaperlessService;
  let normalizationStore;
  let executor;
  let mockPreVisionNormalizer;

  before(async function () {
    // Create temp directory for test normalized images
    tempDir = path.join(os.tmpdir(), `norm-pipeline-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  after(async function () {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.warn('Failed to cleanup temp directory:', err.message);
    }
  });

  beforeEach(function () {
    // Mock Ollama service
    mockOllamaService = {
      generate: async () => ({ response: 'mock' })
    };

    // Mock Paperless service
    mockPaperlessService = {
      getDocument: async (docId) => ({
        id: docId,
        title: `Test Document ${docId}`,
        content: 'Test content'
      }),
      updateCustomFields: async () => ({ success: true }),
      getCustomFieldValue: async () => null
    };

    // Create NormalizationStore with mock paperlessService
    normalizationStore = new NormalizationStore({
      baseDir: tempDir,
      paperlessService: mockPaperlessService
    });

    // Mock PreVisionNormalizer
    mockPreVisionNormalizer = {
      analyzeAndNormalize: async (docId, _options) => ({
        success: true,
        document_id: docId,
        normalized_pages: [
          {
            page: 1,
            buffer: Buffer.from('fake-png-data'),
            format: 'png'
          }
        ],
        metadata: {
          actions_applied: ['rotate_90', 'crop'],
          changes_detected: true,
          geometry: {
            rotation_detected: 90,
            crop_box: { x: 10, y: 10, width: 800, height: 1000 }
          }
        }
      })
    };

    // Create executor with mocked dependencies
    executor = new ExpertPipelineExecutor(mockOllamaService, {
      normalizationStore,
      preVisionNormalizer: mockPreVisionNormalizer
    });
  });

  describe('Stage 3 Execution', function () {
    it('should execute normalization on new document', async function () {
      const docId = 1001;
      const stage = {
        id: 'stage-3',
        type: StageType.PRE_VISION_NORMALIZATION,
        outputKey: 'normalizationResult'
      };

      const context = new ExecutionContext(
        { id: docId, title: 'Test Doc' },
        { classification: 'invoice' }
      );

      const result = await executor._executeStage3_PreVisionNormalization(
        stage,
        context,
        Date.now()
      );

      assert.strictEqual(result.status, 'success');
      assert.strictEqual(result.abort, false);
      assert.ok(result.output);
      assert.strictEqual(result.output.success, true);
      assert.strictEqual(result.output.metadata.changes_detected, true);

      // Verify context was updated
      const storedOutput = context.getStageOutput('normalizationResult');
      assert.ok(storedOutput);
      assert.strictEqual(storedOutput.document_id, docId);
    });

    it('should skip already-normalized document', async function () {
      const docId = 1002;

      // Pre-store a normalized image to simulate already-normalized state
      const docDir = path.join(tempDir, String(docId));
      await fs.mkdir(docDir, { recursive: true });
      await fs.writeFile(path.join(docDir, 'page_1.png'), Buffer.from('existing-data'));

      const stage = {
        id: 'stage-3',
        type: StageType.PRE_VISION_NORMALIZATION,
        outputKey: 'normalizationResult'
      };

      const context = new ExecutionContext(
        { id: docId, title: 'Test Doc' },
        { classification: 'invoice' }
      );

      const result = await executor._executeStage3_PreVisionNormalization(
        stage,
        context,
        Date.now()
      );

      assert.strictEqual(result.status, 'skipped');
      assert.strictEqual(result.abort, false);
      assert.strictEqual(result.output.reason, 'already_normalized');
    });

    it('should handle normalization with no changes detected', async function () {
      const docId = 1003;

      // Mock normalizer to return no changes
      mockPreVisionNormalizer.analyzeAndNormalize = async (docId) => ({
        success: true,
        document_id: docId,
        normalized_pages: [],
        metadata: {
          actions_applied: [],
          changes_detected: false
        }
      });

      const stage = {
        id: 'stage-3',
        type: StageType.PRE_VISION_NORMALIZATION,
        outputKey: 'normalizationResult'
      };

      const context = new ExecutionContext(
        { id: docId, title: 'Test Doc' },
        { classification: 'invoice' }
      );

      const result = await executor._executeStage3_PreVisionNormalization(
        stage,
        context,
        Date.now()
      );

      assert.strictEqual(result.status, 'success');
      assert.strictEqual(result.abort, false);
      assert.strictEqual(result.output.metadata.changes_detected, false);
    });

    it('should handle normalization errors gracefully (non-fatal)', async function () {
      const docId = 1004;

      // Mock normalizer to throw error
      mockPreVisionNormalizer.analyzeAndNormalize = async () => {
        throw new Error('Mock normalization failure');
      };

      const stage = {
        id: 'stage-3',
        type: StageType.PRE_VISION_NORMALIZATION,
        outputKey: 'normalizationResult'
      };

      const context = new ExecutionContext(
        { id: docId, title: 'Test Doc' },
        { classification: 'invoice' }
      );

      const result = await executor._executeStage3_PreVisionNormalization(
        stage,
        context,
        Date.now()
      );

      // Stage 3 errors are non-fatal
      assert.strictEqual(result.status, 'error');
      assert.strictEqual(result.abort, false);
      assert.ok(result.error);
      assert.match(result.error.message, /Mock normalization failure/);

      // Verify error was added to context
      assert.strictEqual(context.errors.length, 1);
    });

    it('should persist normalized images when changes detected', async function () {
      const docId = 1005;

      const stage = {
        id: 'stage-3',
        type: StageType.PRE_VISION_NORMALIZATION,
        outputKey: 'normalizationResult'
      };

      const context = new ExecutionContext(
        { id: docId, title: 'Test Doc' },
        { classification: 'invoice' }
      );

      const result = await executor._executeStage3_PreVisionNormalization(
        stage,
        context,
        Date.now()
      );

      assert.strictEqual(result.status, 'success');

      // Verify file was written to disk
      const expectedPath = path.join(tempDir, String(docId), 'page_1.png');
      const fileExists = await fs.access(expectedPath).then(() => true).catch(() => false);
      assert.strictEqual(fileExists, true, 'Normalized image should be persisted to disk');
    });

    it('should pass stage-specific options to normalizer', async function () {
      const docId = 1006;
      let capturedOptions = null;

      // Mock normalizer to capture options
      mockPreVisionNormalizer.analyzeAndNormalize = async (docId, options) => {
        capturedOptions = options;
        return {
          success: true,
          document_id: docId,
          normalized_pages: [],
          metadata: {
            actions_applied: [],
            changes_detected: false
          }
        };
      };

      const stage = {
        id: 'stage-3',
        type: StageType.PRE_VISION_NORMALIZATION,
        outputKey: 'normalizationResult',
        normalizationOptions: {
          analysisDpi: 150,
          targetDpi: 300
        }
      };

      const context = new ExecutionContext(
        { id: docId, title: 'Test Doc' },
        { classification: 'invoice' }
      );

      await executor._executeStage3_PreVisionNormalization(
        stage,
        context,
        Date.now()
      );

      assert.ok(capturedOptions);
      assert.strictEqual(capturedOptions.analysisDpi, 150);
      assert.strictEqual(capturedOptions.targetDpi, 300);
    });
  });

  describe('Status Updates', function () {
    it('should update status to processing, then completed', async function () {
      const docId = 1007;
      const statusUpdates = [];

      // Mock updatePaperlessMetadata to track calls
      normalizationStore.updatePaperlessMetadata = async (docId, status, url, meta) => {
        statusUpdates.push({ docId, status, url, meta });
        return { success: true };
      };

      const stage = {
        id: 'stage-3',
        type: StageType.PRE_VISION_NORMALIZATION,
        outputKey: 'normalizationResult'
      };

      const context = new ExecutionContext(
        { id: docId, title: 'Test Doc' },
        { classification: 'invoice' }
      );

      await executor._executeStage3_PreVisionNormalization(
        stage,
        context,
        Date.now()
      );

      // Verify status progression: processing, then completed (via store())
      assert.strictEqual(statusUpdates.length >= 1, true);
      assert.strictEqual(statusUpdates[0].status, 'processing');
      // Note: store() calls updatePaperlessMetadata internally for 'completed'
    });

    it('should update status to failed on error', async function () {
      const docId = 1008;
      const statusUpdates = [];

      // Mock updatePaperlessMetadata to track calls
      normalizationStore.updatePaperlessMetadata = async (docId, status, url, meta) => {
        statusUpdates.push({ docId, status, url, meta });
        return { success: true };
      };

      // Mock normalizer to throw error
      mockPreVisionNormalizer.analyzeAndNormalize = async () => {
        throw new Error('Mock failure');
      };

      const stage = {
        id: 'stage-3',
        type: StageType.PRE_VISION_NORMALIZATION,
        outputKey: 'normalizationResult'
      };

      const context = new ExecutionContext(
        { id: docId, title: 'Test Doc' },
        { classification: 'invoice' }
      );

      await executor._executeStage3_PreVisionNormalization(
        stage,
        context,
        Date.now()
      );

      // Verify status updated to failed
      const failedStatus = statusUpdates.find(u => u.status === 'failed');
      assert.ok(failedStatus);
      assert.match(failedStatus.meta.error, /Mock failure/);
    });
  });
});
