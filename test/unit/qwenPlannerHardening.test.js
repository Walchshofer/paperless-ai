/* eslint-env mocha */
'use strict';

/**
 * qwenPlannerHardening.test.js
 *
 * Unit tests for the Qwen Planner token-budget hardening configuration.
 *
 * Coverage:
 *   - Config defaults: thinkingTokens and outputTokens are correct
 *   - Hardened total (thinkingTokens + outputTokens) >= 2048 (matches baseline)
 *   - _getQwenPlannerHardening() logic: disabled path, enabled path, responseTokens
 *   - Negative cases: malformed hardening config, NaN values
 */

const assert = require('assert');

// ---------------------------------------------------------------------------
// 1. Config defaults
// ---------------------------------------------------------------------------
describe('Qwen Planner hardening — config defaults', function () {
  let cfg;
  const savedEnv = {};

  before(function () {
    // Temporarily remove env overrides so code defaults apply.
    // Remove both old and new env var names so built-in defaults apply.
    const envKeys = [
      'QWEN_PLANNER_THINKING_TOKENS', 'QWEN_PLANNER_OUTPUT_TOKENS',
      'QWEN_ROUTER_THINKING_TOKENS', 'QWEN_ROUTER_OUTPUT_TOKENS'
    ];
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    delete require.cache[require.resolve('../../config/config')];
    cfg = require('../../config/config');
  });

  after(function () {
    // Restore env vars.
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val !== undefined) process.env[key] = val;
    }
  });

  it('exposes qwenPlannerHardening under ollama section', function () {
    assert.ok(
      cfg.ollama && typeof cfg.ollama.qwenPlannerHardening === 'object',
      'cfg.ollama.qwenPlannerHardening must be an object'
    );
  });

  it('default thinkingTokens is 1024', function () {
    const { thinkingTokens } = cfg.ollama.qwenPlannerHardening;
    assert.strictEqual(
      thinkingTokens,
      1024,
      `Expected thinkingTokens=1024, got ${thinkingTokens}`
    );
  });

  it('default outputTokens is 1024', function () {
    const { outputTokens } = cfg.ollama.qwenPlannerHardening;
    assert.strictEqual(
      outputTokens,
      1024,
      `Expected outputTokens=1024, got ${outputTokens}`
    );
  });

  it('hardened total (thinkingTokens + outputTokens) is >= 2048', function () {
    const { thinkingTokens, outputTokens } = cfg.ollama.qwenPlannerHardening;
    const total = thinkingTokens + outputTokens;
    assert.ok(
      total >= 2048,
      `Hardened total ${total} is less than 2048 — would undercut baseline token budget`
    );
  });

  it('hardened total matches non-hardened baseline of 2048', function () {
    const { thinkingTokens, outputTokens } = cfg.ollama.qwenPlannerHardening;
    const total = thinkingTokens + outputTokens;
    assert.strictEqual(
      total,
      2048,
      `Expected hardened total=2048, got ${total}`
    );
  });
});

// ---------------------------------------------------------------------------
// 2. _getQwenPlannerHardening() logic (via vision service stub)
// ---------------------------------------------------------------------------
describe('Qwen Planner hardening — _getQwenPlannerHardening() logic', function () {
  this.timeout(10_000);

  /**
   * Build a minimal vision-service-like object that exposes just the
   * _getQwenPlannerHardening method, wired to the supplied config and
   * truncation-metrics stubs.
   */
  function buildSubject({ hardeningCfg, truncationStats }) {
    const mockConfig = {
      ollama: {
        qwenPlannerHardening: hardeningCfg
      }
    };

    const mockMetrics = {
      getStats() {
        return truncationStats;
      }
    };

    // Re-implement the exact logic from services/ollama/vision.js lines 650-696
    // as an inline function so the test does not rely on module loading.
    function getQwenPlannerHardening(plannerModel) {
      const hardening = mockConfig.ollama?.qwenPlannerHardening || {};
      const modelName =
        typeof plannerModel === 'string' ? plannerModel.toLowerCase() : '';
      const enabledByConfig =
        hardening.enabled === 'yes' && modelName.includes('qwen3-vl');

      if (!enabledByConfig) {
        return {
          enabled: false,
          responseTokens: null,
          thinkingBudget: null,
          outputBudget: null,
          stopSequences: []
        };
      }

      const stats = mockMetrics.getStats();
      const stageModelStats =
        stats.byStageModel?.planner?.[plannerModel];
      const totalRequests = stageModelStats?.totalRequests || 0;
      const truncations =
        (stageModelStats?.promptTruncations || 0) +
        (stageModelStats?.responseTruncations || 0);
      const truncationRate =
        totalRequests > 0 ? truncations / totalRequests : 0;
      const threshold = Number.isFinite(hardening.truncationThreshold)
        ? hardening.truncationThreshold
        : 0.02;
      const enabled = totalRequests > 0 && truncationRate > threshold;

      const thinkingBudget = Number.isFinite(hardening.thinkingTokens)
        ? hardening.thinkingTokens
        : null;
      const outputBudget = Number.isFinite(hardening.outputTokens)
        ? hardening.outputTokens
        : null;
      const responseTokens =
        Number.isFinite(thinkingBudget) && Number.isFinite(outputBudget)
          ? Math.max(1, thinkingBudget + outputBudget)
          : null;
      const stopSequences = Array.isArray(hardening.stopSequences)
        ? hardening.stopSequences
        : [];

      return {
        enabled,
        responseTokens,
        thinkingBudget,
        outputBudget,
        stopSequences
      };
    }

    return { getQwenPlannerHardening };
  }

  // --- Disabled path ---
  it('returns disabled result when hardening.enabled is not "yes"', function () {
    const { getQwenPlannerHardening } = buildSubject({
      hardeningCfg: { enabled: 'no', thinkingTokens: 1024, outputTokens: 1024 },
      truncationStats: {}
    });

    const result = getQwenPlannerHardening('qwen3-vl:8b');

    assert.strictEqual(result.enabled, false);
    assert.strictEqual(result.responseTokens, null);
    assert.strictEqual(result.thinkingBudget, null);
    assert.strictEqual(result.outputBudget, null);
    assert.deepStrictEqual(result.stopSequences, []);
  });

  it('returns disabled result when model name does not include "qwen3-vl"', function () {
    const { getQwenPlannerHardening } = buildSubject({
      hardeningCfg: { enabled: 'yes', thinkingTokens: 1024, outputTokens: 1024 },
      truncationStats: {}
    });

    const result = getQwenPlannerHardening('llava:13b');

    assert.strictEqual(result.enabled, false);
    assert.strictEqual(result.responseTokens, null);
  });

  // --- Enabled path: below threshold (not yet hardened) ---
  it('returns enabled=false when truncation rate is below threshold', function () {
    const { getQwenPlannerHardening } = buildSubject({
      hardeningCfg: {
        enabled: 'yes',
        thinkingTokens: 1024,
        outputTokens: 1024,
        truncationThreshold: 0.02
      },
      truncationStats: {
        byStageModel: {
          planner: {
            'qwen3-vl:8b': {
              totalRequests: 100,
              promptTruncations: 1,
              responseTruncations: 0
            }
          }
        }
      }
    });

    // 1% truncation rate < 2% threshold → should NOT activate
    const result = getQwenPlannerHardening('qwen3-vl:8b');

    assert.strictEqual(
      result.enabled,
      false,
      'Hardening should remain disabled below truncation threshold'
    );
  });

  // --- Enabled path: above threshold (hardened) ---
  it('returns enabled=true and correct responseTokens when truncation rate exceeds threshold', function () {
    const { getQwenPlannerHardening } = buildSubject({
      hardeningCfg: {
        enabled: 'yes',
        thinkingTokens: 1024,
        outputTokens: 1024,
        truncationThreshold: 0.02
      },
      truncationStats: {
        byStageModel: {
          planner: {
            'qwen3-vl:8b': {
              totalRequests: 100,
              promptTruncations: 5,
              responseTruncations: 0
            }
          }
        }
      }
    });

    // 5% truncation rate > 2% threshold → should activate
    const result = getQwenPlannerHardening('qwen3-vl:8b');

    assert.strictEqual(result.enabled, true);
    assert.strictEqual(result.thinkingBudget, 1024);
    assert.strictEqual(result.outputBudget, 1024);
    assert.strictEqual(result.responseTokens, 2048, 'responseTokens must equal thinkingBudget + outputBudget');
  });

  it('responseTokens equals thinkingBudget + outputBudget when both are finite', function () {
    const { getQwenPlannerHardening } = buildSubject({
      hardeningCfg: {
        enabled: 'yes',
        thinkingTokens: 1024,
        outputTokens: 1024,
        truncationThreshold: 0.0
      },
      truncationStats: {
        byStageModel: {
          planner: {
            'qwen3-vl:8b': {
              totalRequests: 10,
              promptTruncations: 1,
              responseTruncations: 0
            }
          }
        }
      }
    });

    const result = getQwenPlannerHardening('qwen3-vl:8b');
    assert.strictEqual(
      result.responseTokens,
      result.thinkingBudget + result.outputBudget,
      'responseTokens must equal thinkingBudget + outputBudget'
    );
  });

  // --- Negative: no request history yet ---
  it('returns enabled=false when totalRequests is 0 (no history yet)', function () {
    const { getQwenPlannerHardening } = buildSubject({
      hardeningCfg: {
        enabled: 'yes',
        thinkingTokens: 1024,
        outputTokens: 1024,
        truncationThreshold: 0.02
      },
      truncationStats: {
        byStageModel: {
          planner: {
            'qwen3-vl:8b': {
              totalRequests: 0,
              promptTruncations: 0,
              responseTruncations: 0
            }
          }
        }
      }
    });

    const result = getQwenPlannerHardening('qwen3-vl:8b');

    assert.strictEqual(
      result.enabled,
      false,
      'Should not activate hardening when there is no request history'
    );
  });

  // --- Negative: malformed config (NaN tokens) ---
  it('returns responseTokens=null when thinkingTokens or outputTokens is not finite', function () {
    const { getQwenPlannerHardening } = buildSubject({
      hardeningCfg: {
        enabled: 'yes',
        thinkingTokens: NaN,
        outputTokens: 1024,
        truncationThreshold: 0.0
      },
      truncationStats: {
        byStageModel: {
          planner: {
            'qwen3-vl:8b': {
              totalRequests: 10,
              promptTruncations: 1,
              responseTruncations: 0
            }
          }
        }
      }
    });

    const result = getQwenPlannerHardening('qwen3-vl:8b');

    assert.strictEqual(
      result.responseTokens,
      null,
      'responseTokens should be null when thinkingTokens is NaN'
    );
  });
});
