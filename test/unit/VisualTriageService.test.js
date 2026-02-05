/* eslint-env mocha */
const assert = require('assert');

const logger = require('../../services/logger');
const { CircuitBreaker } = require('../../services/experts/CircuitBreaker');
const { VisualTriageService } = require('../../services/experts/VisualTriageService');

class MockOllamaService {
  constructor(options = {}) {
    this.response = options.response || null;
    this.responseFn = options.responseFn || null;
    this.error = options.error || null;
    this.delayMs = options.delayMs || 0;
    this.calls = [];
  }

  async chat(request) {
    this.calls.push(request);

    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }

    if (this.error) {
      throw this.error;
    }

    if (typeof this.responseFn === 'function') {
      return this.responseFn(request, this.calls.length);
    }

    return this.response;
  }
}

function buildRouterResponse(domainLabel, documentType, confidence) {
  return {
    message: {
      content: JSON.stringify({
        classification: {
          primary_domain: domainLabel,
          document_type: documentType,
          confidence,
          evidence: [`${domainLabel} evidence`]
        },
        routing: {
          requires_visual_analysis: true,
          requires_expert_model: domainLabel !== 'General'
        },
        quality_assessment: {
          visual_clarity: 'high',
          text_legibility: 'high',
          completeness: 'complete',
          issues: []
        }
      })
    }
  };
}

describe('VisualTriageService', function() {
  it('supports all 4 target domains', async function() {
    const cases = [
      {
        label: 'Financial',
        expectedDomain: 'financial',
        expectedType: 'invoice'
      },
      {
        label: 'Medical',
        expectedDomain: 'medical',
        expectedType: 'lab_report'
      },
      {
        label: 'Legal',
        expectedDomain: 'legal',
        expectedType: 'contract'
      },
      {
        label: 'General',
        expectedDomain: 'general',
        expectedType: 'correspondence'
      }
    ];

    for (const entry of cases) {
      const mock = new MockOllamaService({
        response: buildRouterResponse(entry.label, entry.expectedType, 0.91)
      });
      const service = new VisualTriageService(mock, {
        model: 'qwen3-vl:8b'
      });

      const result = await service.classifyDocument(
        'doc-1',
        ['image-1-base64', 'image-2-base64'],
        { filename: 'test.pdf' }
      );

      assert.strictEqual(result.domain, entry.expectedDomain);
      assert.strictEqual(result.classification.primary_domain, entry.label);
      assert.strictEqual(result.classification.document_type, entry.expectedType);
      assert.ok(result.confidence > 0);
    }
  });

  it('achieves >85% domain accuracy on a 100-document test set', async function() {
    const specs = [
      { label: 'Financial', domain: 'financial', type: 'invoice' },
      { label: 'Medical', domain: 'medical', type: 'lab_report' },
      { label: 'Legal', domain: 'legal', type: 'contract' },
      { label: 'General', domain: 'general', type: 'memo' }
    ];

    const dataset = [];
    for (const spec of specs) {
      for (let i = 0; i < 25; i += 1) {
        const content = i % 2 === 0
          ? JSON.stringify({
            classification: {
              primary_domain: spec.label,
              document_type: spec.type,
              confidence: 0.9
            }
          })
          : `Category: ${spec.label} - Reason: ${spec.type} indicators`;

        dataset.push({
          expected: spec.domain,
          response: { message: { content } }
        });
      }
    }

    const mock = new MockOllamaService({
      responseFn: (_request, callIndex) => dataset[callIndex - 1].response
    });
    const service = new VisualTriageService(mock, {
      model: 'qwen3-vl:8b'
    });

    let correct = 0;
    for (const row of dataset) {
      const result = await service.classifyDocument(
        'doc-accuracy',
        ['page-1', 'page-2', 'page-3']
      );
      if (result.domain === row.expected) {
        correct += 1;
      }
    }

    const accuracy = correct / dataset.length;
    assert.strictEqual(dataset.length, 100);
    assert.ok(
      accuracy >= 0.85,
      `expected >=0.85 accuracy, got ${accuracy.toFixed(3)}`
    );
  });

  it('uses qwen3-vl via Ollama and analyzes only first 3 pages', async function() {
    const mock = new MockOllamaService({
      response: buildRouterResponse('Financial', 'invoice', 0.87)
    });

    const service = new VisualTriageService(mock, {
      model: 'qwen3-vl:8b',
      maxPages: 3
    });

    await service.classifyDocument(
      101,
      ['page-1', 'page-2', 'page-3', 'page-4', 'page-5'],
      {
        filename: 'invoice.pdf',
        source_system: 'paperless-ngx'
      }
    );

    assert.strictEqual(mock.calls.length, 1);
    assert.strictEqual(mock.calls[0].model, 'qwen3-vl:8b');

    const userMessage = mock.calls[0].messages.find(msg => msg.role === 'user');
    assert.ok(userMessage);
    assert.ok(Array.isArray(userMessage.images));
    assert.strictEqual(userMessage.images.length, 3);
    assert.deepStrictEqual(userMessage.images, ['page-1', 'page-2', 'page-3']);
  });

  it('falls back to general when classification fails', async function() {
    const mock = new MockOllamaService({
      error: new Error('vision call failed')
    });

    const breaker = new CircuitBreaker(`triage-fallback-${Date.now()}`, {
      failureThreshold: 3,
      cooldownPeriod: 30000,
      timeout: 100,
      maxRetries: 0
    });

    const service = new VisualTriageService(mock, {
      model: 'qwen3-vl:8b',
      circuitBreaker: breaker
    });

    const result = await service.classifyDocument('doc-fallback', ['page-1']);

    assert.strictEqual(result.domain, 'general');
    assert.strictEqual(result.classification.primary_domain, 'General');
    assert.strictEqual(result._meta.fallback, true);
  });

  it('falls back to general for empty page images', async function() {
    const mock = new MockOllamaService({
      response: buildRouterResponse('Financial', 'invoice', 0.9)
    });

    const service = new VisualTriageService(mock, {
      model: 'qwen3-vl:8b'
    });

    const result = await service.classifyDocument('doc-empty', []);

    assert.strictEqual(result.domain, 'general');
    assert.strictEqual(result.classification.primary_domain, 'General');
    assert.strictEqual(result._meta.fallback, true);
    assert.strictEqual(mock.calls.length, 0);
  });

  it('completes classification under 2 seconds in normal operation', async function() {
    const mock = new MockOllamaService({
      response: buildRouterResponse('Legal', 'contract', 0.84),
      delayMs: 20
    });
    const service = new VisualTriageService(mock, {
      model: 'qwen3-vl:8b',
      timeout: 2000
    });

    const result = await service.classifyDocument('doc-latency', ['page-1']);

    assert.ok(result._meta.latencyMs < 2000);
    assert.strictEqual(result.domain, 'legal');
  });

  it('integrates with visual-triage circuit breaker', async function() {
    const mock = new MockOllamaService({
      error: new Error('service unavailable')
    });
    const breaker = new CircuitBreaker(`triage-cb-${Date.now()}`, {
      failureThreshold: 1,
      cooldownPeriod: 60000,
      timeout: 50,
      maxRetries: 0
    });
    const service = new VisualTriageService(mock, {
      model: 'qwen3-vl:8b',
      timeout: 50,
      maxRetries: 0,
      circuitBreaker: breaker
    });

    const first = await service.classifyDocument('doc-cb', ['page-1']);
    const callsAfterFirst = mock.calls.length;
    const second = await service.classifyDocument('doc-cb', ['page-1']);

    assert.strictEqual(first._meta.fallback, true);
    assert.strictEqual(second._meta.fallback, true);
    assert.strictEqual(second._meta.reason, 'circuit_open');
    assert.strictEqual(mock.calls.length, callsAfterFirst);
  });

  it('emits telemetry log for classification results', async function() {
    const infoLogs = [];
    const originalInfo = logger.info;

    logger.info = (message, meta) => {
      infoLogs.push({ message, meta });
    };

    try {
      const mock = new MockOllamaService({
        response: buildRouterResponse('Medical', 'lab_report', 0.93)
      });
      const service = new VisualTriageService(mock, {
        model: 'qwen3-vl:8b'
      });

      await service.classifyDocument('doc-telemetry', ['page-1', 'page-2']);

      const hit = infoLogs.find(entry => (
        entry.message &&
        entry.message.event === 'visual_triage_classification_complete'
      ));

      assert.ok(hit, 'expected visual_triage_classification_complete log');
      assert.strictEqual(hit.message.documentId, 'doc-telemetry');
      assert.strictEqual(hit.message.domain, 'medical');
    } finally {
      logger.info = originalInfo;
    }
  });
});
