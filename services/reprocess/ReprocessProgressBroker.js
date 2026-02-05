const { EventEmitter } = require('events');

const REPROCESS_STAGE_DEFINITIONS = Object.freeze({
  queued: {
    stage: 'queued',
    label: 'Queued for re-analysis',
    percentage: 5,
    status: 'in_progress'
  },
  classifying: {
    stage: 'classifying',
    label: 'Classifying document domain',
    percentage: 20,
    status: 'in_progress'
  },
  extracting: {
    stage: 'extracting',
    label: 'Extracting fields with expert pipeline',
    percentage: 55,
    status: 'in_progress'
  },
  persisting: {
    stage: 'persisting',
    label: 'Persisting metadata updates',
    percentage: 80,
    status: 'in_progress'
  },
  completed: {
    stage: 'completed',
    label: 'Re-analysis complete',
    percentage: 100,
    status: 'completed'
  },
  failed: {
    stage: 'failed',
    label: 'Re-analysis failed',
    percentage: 100,
    status: 'failed'
  }
});

function clampPercentage(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildProgressUpdate(documentId, partial = {}) {
  const stageKey = String(partial.stage || '').toLowerCase();
  const base = REPROCESS_STAGE_DEFINITIONS[stageKey] || {};

  return {
    documentId: Number.isFinite(Number(documentId))
      ? Number(documentId)
      : String(documentId),
    stage: partial.stage || base.stage || 'queued',
    label: partial.label || base.label || 'Reprocessing document',
    status: partial.status || base.status || 'in_progress',
    percentage: clampPercentage(
      Number.isFinite(Number(partial.percentage))
        ? Number(partial.percentage)
        : Number(base.percentage)
    ),
    details: partial.details || null,
    timestamp: partial.timestamp || new Date().toISOString()
  };
}

class ReprocessProgressBroker {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(0);
  }

  _channel(documentId) {
    return `reprocess:${String(documentId)}`;
  }

  subscribe(documentId, listener) {
    const channel = this._channel(documentId);
    this.emitter.on(channel, listener);
    return () => this.unsubscribe(documentId, listener);
  }

  unsubscribe(documentId, listener) {
    const channel = this._channel(documentId);
    this.emitter.off(channel, listener);
  }

  publish(documentId, update = {}) {
    const payload = buildProgressUpdate(documentId, update);
    const channel = this._channel(documentId);
    this.emitter.emit(channel, payload);
    return payload;
  }
}

const reprocessProgressBroker = new ReprocessProgressBroker();

module.exports = {
  REPROCESS_STAGE_DEFINITIONS,
  buildProgressUpdate,
  ReprocessProgressBroker,
  reprocessProgressBroker
};
