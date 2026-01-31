
const assert = require('assert');
const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');

const buildContext = (overrides = {}) => {
  const stageOutputs = new Map(Object.entries(overrides.stageOutputs || {}));
  const errors = [];
  const skipped = [];

  return {
    document: {
      id: 123,
      filename: 'doc-123.pdf',
      imageBase64: 'data:image/png;base64,AAA',
      ...overrides.document
    },
    options: overrides.options || {},
    visualSidecarAvailable: overrides.visualSidecarAvailable,
    getStageOutput: (key) => stageOutputs.get(key),
    setStageOutput: (key, output) => stageOutputs.set(key, output),
    skipStage: (stageId, reason) => skipped.push({ stageId, reason }),
    addError: (stageId, error) => errors.push({ stageId, error }),
    errors,
    skipped
  };
};

describe('ExpertPipelineExecutor visual text fallback', () => {
  it('falls back to text rag when visual sidecar is unavailable', async () => {
    const mockVisualSearchClient = {
      isAvailable: async () => false
    };
    const mockRagService = {
      checkStatus: async () => ({
        server_up: true,
        index_ready: true,
        data_loaded: true
      }),
      search: async () => ([
        { doc_id: 123, snippet: 'match', score: 0.9 }
      ])
    };

    const executor = new ExpertPipelineExecutor({}, {
      enableVisualRag: true,
      enableMetrics: false,
      visualSearchClient: mockVisualSearchClient,
      ragService: mockRagService
    });

    const context = buildContext({
      stageOutputs: {
        extraction: { fields: [{ name: 'total', confidence: 0.8 }] },
        visual_queries: {
          queries: [{ question: 'total amount', field_target: 'total' }]
        }
      }
    });

    const stage = { id: 'visual_execution', outputKey: 'visual_execution' };
    const result = await executor._executeVisualQueryExecutionStage(
      stage,
      context,
      Date.now()
    );

    const output = context.getStageOutput('visual_execution');
    assert.strictEqual(result.status, 'warning');
    assert.ok(output.metadata.fallback);
    assert.strictEqual(output.metadata.fallback_reason, 'visual_503_fallback_text');
    assert.strictEqual(output.metadata.evidence_source, 'text');
    assert.ok(output.metadata.manual_review_required);
    assert.ok(Array.isArray(output.metadata.text_evidence));
    assert.ok(output.fields[0].confidence < 0.8);
  });

  it('surfaces an error when both visual and text rag are unavailable', async () => {
    const mockVisualSearchClient = {
      isAvailable: async () => false
    };
    const mockRagService = {
      checkStatus: async () => ({
        server_up: false,
        index_ready: false,
        data_loaded: false,
        error: 'text rag down'
      })
    };

    const executor = new ExpertPipelineExecutor({}, {
      enableVisualRag: true,
      enableMetrics: false,
      visualSearchClient: mockVisualSearchClient,
      ragService: mockRagService
    });

    const context = buildContext({
      stageOutputs: {
        extraction: { fields: [{ name: 'total', confidence: 0.8 }] },
        visual_queries: {
          queries: [{ question: 'total amount', field_target: 'total' }]
        }
      }
    });

    const stage = { id: 'visual_execution', outputKey: 'visual_execution' };
    const result = await executor._executeVisualQueryExecutionStage(
      stage,
      context,
      Date.now()
    );

    const output = context.getStageOutput('visual_execution');
    assert.strictEqual(result.status, 'error');
    assert.ok(output.metadata.text_fallback_unavailable);
    assert.strictEqual(output.metadata.evidence_source, 'none');
    assert.ok(context.errors.length > 0);
  });
});
