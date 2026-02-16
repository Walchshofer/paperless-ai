/* eslint-env mocha */
'use strict';

/**
 * reprocessProgressBroker.test.js
 *
 * Unit tests for ReprocessProgressBroker and REPROCESS_STAGE_DEFINITIONS.
 *
 * Coverage:
 *   - expert_thinking stage definition exists with correct shape
 *   - All expected pipeline stages are registered
 *   - buildProgressUpdate() merges stage defaults correctly
 *   - publish() emits correct payload to subscribers
 *   - subscribe() / unsubscribe() lifecycle
 *   - Negative cases: unknown stage keys, invalid documentId, clamping
 */

const assert = require('assert');

const {
  REPROCESS_STAGE_DEFINITIONS,
  REPROCESS_ERROR_MESSAGES,
  buildProgressUpdate,
  ReprocessProgressBroker,
  reprocessProgressBroker
} = require('../../services/reprocess/ReprocessProgressBroker');

// ---------------------------------------------------------------------------
// 1. REPROCESS_STAGE_DEFINITIONS contract
// ---------------------------------------------------------------------------
describe('REPROCESS_STAGE_DEFINITIONS', function () {
  it('is a frozen object (immutable)', function () {
    assert.ok(Object.isFrozen(REPROCESS_STAGE_DEFINITIONS));
  });

  it('contains expert_thinking stage', function () {
    assert.ok(
      Object.prototype.hasOwnProperty.call(REPROCESS_STAGE_DEFINITIONS, 'expert_thinking'),
      'REPROCESS_STAGE_DEFINITIONS must include expert_thinking'
    );
  });

  it('expert_thinking has correct shape', function () {
    const def = REPROCESS_STAGE_DEFINITIONS.expert_thinking;

    assert.strictEqual(typeof def, 'object');
    assert.strictEqual(def.stage, 'expert_thinking');
    assert.strictEqual(typeof def.label, 'string');
    assert.ok(def.label.length > 0, 'expert_thinking label must be non-empty');
    assert.strictEqual(typeof def.percentage, 'number');
    assert.ok(
      def.percentage >= 0 && def.percentage <= 100,
      `expert_thinking percentage must be 0-100, got ${def.percentage}`
    );
    assert.strictEqual(def.status, 'in_progress');
  });

  it('expert_thinking percentage is 40', function () {
    assert.strictEqual(REPROCESS_STAGE_DEFINITIONS.expert_thinking.percentage, 40);
  });

  it('expert_thinking label is "Expert model reasoning"', function () {
    assert.strictEqual(
      REPROCESS_STAGE_DEFINITIONS.expert_thinking.label,
      'Expert model reasoning'
    );
  });

  // Verify the full set of expected pipeline stages is registered
  const expectedStages = [
    'queued',
    'visual_triage',
    'visual_extraction',
    'expert_thinking',
    'query_generation',
    'query_execution',
    'ocr_fallback',
    'hybrid_fusion',
    'storage',
    'completed',
    'failed'
  ];

  for (const stageName of expectedStages) {
    it(`stage "${stageName}" is registered`, function () {
      assert.ok(
        Object.prototype.hasOwnProperty.call(REPROCESS_STAGE_DEFINITIONS, stageName),
        `Missing stage definition: "${stageName}"`
      );
    });
  }

  it('all stages have the required properties: stage, label, percentage, status', function () {
    for (const [key, def] of Object.entries(REPROCESS_STAGE_DEFINITIONS)) {
      assert.strictEqual(typeof def.stage, 'string', `${key}.stage must be string`);
      assert.strictEqual(typeof def.label, 'string', `${key}.label must be string`);
      assert.strictEqual(typeof def.percentage, 'number', `${key}.percentage must be number`);
      assert.strictEqual(typeof def.status, 'string', `${key}.status must be string`);
    }
  });

  it('stage key matches the stage property value for every entry', function () {
    for (const [key, def] of Object.entries(REPROCESS_STAGE_DEFINITIONS)) {
      assert.strictEqual(
        def.stage,
        key,
        `Stage key "${key}" must match def.stage "${def.stage}"`
      );
    }
  });

  it('stages increase or maintain percentage order in the pipeline flow', function () {
    // Pipeline order is defined by REPROCESS_STEPS in SmartMetadataIsland.
    // The stage definitions must honour this ordering.
    const pipelineOrder = [
      'queued',
      'visual_triage',
      'visual_extraction',
      'expert_thinking',
      'query_generation',
      'query_execution',
      'ocr_fallback',
      'hybrid_fusion',
      'storage'
    ];

    let prev = -1;
    for (const key of pipelineOrder) {
      const pct = REPROCESS_STAGE_DEFINITIONS[key].percentage;
      assert.ok(
        pct >= prev,
        `Stage "${key}" percentage ${pct} must be >= previous stage percentage ${prev}`
      );
      prev = pct;
    }
  });
});

// ---------------------------------------------------------------------------
// 2. REPROCESS_ERROR_MESSAGES
// ---------------------------------------------------------------------------
describe('REPROCESS_ERROR_MESSAGES', function () {
  it('is a frozen object', function () {
    assert.ok(Object.isFrozen(REPROCESS_ERROR_MESSAGES));
  });

  it('contains all required error codes', function () {
    const required = [
      'visual-rag-unavailable',
      'ollama-timeout',
      'qdrant-connection-failed',
      'invalid-document',
      'pipeline-execution-failed'
    ];
    for (const code of required) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(REPROCESS_ERROR_MESSAGES, code),
        `Missing error message for code "${code}"`
      );
      assert.strictEqual(
        typeof REPROCESS_ERROR_MESSAGES[code],
        'string',
        `Error message for "${code}" must be a string`
      );
      assert.ok(
        REPROCESS_ERROR_MESSAGES[code].length > 0,
        `Error message for "${code}" must be non-empty`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 3. buildProgressUpdate()
// ---------------------------------------------------------------------------
describe('buildProgressUpdate()', function () {
  it('returns expert_thinking defaults when stage="expert_thinking"', function () {
    const update = buildProgressUpdate(42, { stage: 'expert_thinking' });

    assert.strictEqual(update.documentId, 42);
    assert.strictEqual(update.stage, 'expert_thinking');
    assert.strictEqual(update.label, 'Expert model reasoning');
    assert.strictEqual(update.percentage, 40);
    assert.strictEqual(update.status, 'in_progress');
  });

  it('overrides defaults with explicit partial fields', function () {
    const update = buildProgressUpdate(7, {
      stage: 'expert_thinking',
      label: 'Custom label',
      percentage: 45,
      status: 'completed'
    });

    assert.strictEqual(update.label, 'Custom label');
    assert.strictEqual(update.percentage, 45);
    assert.strictEqual(update.status, 'completed');
  });

  it('clamps percentage to [0, 100]', function () {
    const tooHigh = buildProgressUpdate(1, { stage: 'storage', percentage: 150 });
    assert.strictEqual(tooHigh.percentage, 100);

    const tooLow = buildProgressUpdate(1, { stage: 'queued', percentage: -20 });
    assert.strictEqual(tooLow.percentage, 0);
  });

  it('falls back to queued defaults for unknown stage', function () {
    const update = buildProgressUpdate(99, { stage: 'nonexistent_stage' });

    // Unknown stages fall back to raw partial or minimal defaults.
    // stage field is preserved from partial, percentage from base (0 because no base found)
    assert.strictEqual(update.stage, 'nonexistent_stage');
    assert.strictEqual(update.percentage, 0);
  });

  it('normalises documentId: numeric string becomes number', function () {
    const update = buildProgressUpdate('99', { stage: 'queued' });
    assert.strictEqual(update.documentId, 99);
    assert.strictEqual(typeof update.documentId, 'number');
  });

  it('preserves non-numeric documentId as string', function () {
    const update = buildProgressUpdate('doc-abc', { stage: 'queued' });
    assert.strictEqual(update.documentId, 'doc-abc');
    assert.strictEqual(typeof update.documentId, 'string');
  });

  it('sets timestamp to an ISO string', function () {
    const update = buildProgressUpdate(1, { stage: 'queued' });
    assert.strictEqual(typeof update.timestamp, 'string');
    assert.ok(
      !Number.isNaN(Date.parse(update.timestamp)),
      'timestamp must be a valid ISO date string'
    );
  });

  it('details defaults to null when not supplied', function () {
    const update = buildProgressUpdate(1, { stage: 'queued' });
    assert.strictEqual(update.details, null);
  });

  it('preserves explicit details', function () {
    const update = buildProgressUpdate(1, { stage: 'queued', details: 'extra info' });
    assert.strictEqual(update.details, 'extra info');
  });
});

// ---------------------------------------------------------------------------
// 4. ReprocessProgressBroker — subscribe / publish / unsubscribe
// ---------------------------------------------------------------------------
describe('ReprocessProgressBroker', function () {
  let broker;

  beforeEach(function () {
    broker = new ReprocessProgressBroker();
  });

  it('publish() emits a structured payload to subscriber', function (done) {
    broker.subscribe(42, (payload) => {
      try {
        assert.strictEqual(payload.documentId, 42);
        assert.strictEqual(payload.stage, 'expert_thinking');
        assert.strictEqual(payload.percentage, 40);
        assert.strictEqual(payload.status, 'in_progress');
        done();
      } catch (err) {
        done(err);
      }
    });

    broker.publish(42, { stage: 'expert_thinking' });
  });

  it('publish() returns the constructed payload', function () {
    const payload = broker.publish(1, { stage: 'expert_thinking' });
    assert.strictEqual(payload.stage, 'expert_thinking');
    assert.strictEqual(payload.documentId, 1);
  });

  it('subscribe() returns an unsubscribe function', function () {
    const unsub = broker.subscribe(1, () => {});
    assert.strictEqual(typeof unsub, 'function');
    // Calling the unsubscribe function must not throw.
    assert.doesNotThrow(() => unsub());
  });

  it('unsubscribe() prevents further event delivery', function (done) {
    let callCount = 0;
    const listener = () => { callCount += 1; };

    broker.subscribe(10, listener);
    broker.unsubscribe(10, listener);
    broker.publish(10, { stage: 'queued' });

    // Use setImmediate to ensure any synchronous emit has settled.
    setImmediate(() => {
      try {
        assert.strictEqual(callCount, 0, 'listener must not be called after unsubscribe');
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  it('subscribes different listeners on different document IDs independently', function (done) {
    const results = [];
    broker.subscribe(100, (p) => results.push({ id: p.documentId, stage: p.stage }));
    broker.subscribe(200, (p) => results.push({ id: p.documentId, stage: p.stage }));

    broker.publish(100, { stage: 'expert_thinking' });
    broker.publish(200, { stage: 'visual_triage' });

    setImmediate(() => {
      try {
        assert.strictEqual(results.length, 2);
        const byId = {};
        for (const r of results) byId[r.id] = r.stage;
        assert.strictEqual(byId[100], 'expert_thinking');
        assert.strictEqual(byId[200], 'visual_triage');
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  // Negative: publish to a channel with no subscribers must not throw
  it('publish() to channel with no subscribers does not throw', function () {
    assert.doesNotThrow(() => {
      broker.publish(9999, { stage: 'expert_thinking' });
    });
  });

  // Singleton instance is exported
  it('reprocessProgressBroker is a singleton ReprocessProgressBroker instance', function () {
    assert.ok(reprocessProgressBroker instanceof ReprocessProgressBroker);
  });
});
