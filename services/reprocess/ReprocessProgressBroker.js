const { EventEmitter } = require('events');

const REPROCESS_STAGE_DEFINITIONS = Object.freeze({
  queued: {
    stage: 'queued',
    label: 'Queued for re-analysis',
    percentage: 5,
    status: 'in_progress'
  },
  visual_triage: {
    stage: 'visual_triage',
    label: 'Visual triage',
    percentage: 10,
    status: 'in_progress'
  },
  visual_extraction: {
    stage: 'visual_extraction',
    label: 'Visual extraction',
    percentage: 25,
    status: 'in_progress'
  },
  expert_thinking: {
    stage: 'expert_thinking',
    label: 'Expert model reasoning',
    percentage: 40,
    status: 'in_progress'
  },
  query_generation: {
    stage: 'query_generation',
    label: 'Generating visual queries',
    percentage: 50,
    status: 'in_progress'
  },
  query_execution: {
    stage: 'query_execution',
    label: 'Executing visual queries',
    percentage: 70,
    status: 'in_progress'
  },
  ocr_fallback: {
    stage: 'ocr_fallback',
    label: 'Applying OCR fallback',
    percentage: 85,
    status: 'in_progress'
  },
  hybrid_fusion: {
    stage: 'hybrid_fusion',
    label: 'Merging visual and text evidence',
    percentage: 95,
    status: 'in_progress'
  },
  storage: {
    stage: 'storage',
    label: 'Persisting metadata updates',
    percentage: 100,
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

const REPROCESS_ERROR_MESSAGES = Object.freeze({
  'visual-rag-unavailable': (
    'GPU Preparing: visual search is temporarily unavailable. '
    + 'Using text-based extraction fallback.'
  ),
  'ollama-timeout': (
    'Vision model is taking longer than expected. '
    + 'Retrying with exponential backoff.'
  ),
  'qdrant-connection-failed': (
    'Vector search is temporarily unavailable because the circuit breaker is '
    + 'open. Please try again later.'
  ),
  'invalid-document': (
    'This document format is not supported. '
    + 'Please upload a PDF or image file.'
  ),
  'pipeline-execution-failed': (
    'We could not complete visual re-analysis. '
    + 'Please retry in a moment.'
  )
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
  REPROCESS_ERROR_MESSAGES,
  buildProgressUpdate,
  ReprocessProgressBroker,
  reprocessProgressBroker
};
