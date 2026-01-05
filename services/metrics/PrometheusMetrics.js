const client = require('prom-client');
const logger = require('../logger');

const DEFAULT_LABELS = { app: 'paperless-ai' };
const CIRCUIT_STATE_VALUES = {
    CLOSED: 0,
    OPEN: 1,
    HALF_OPEN: 2
};

class PrometheusMetrics {
    constructor(registry = client.register) {
        this.registry = registry;
        this._initialized = false;
        this._ocrSourceTotals = {};
        this._ocrSourceCounts = {};
        this._feedbackTotals = {};
        this._fieldCorrectionCounts = {};
        this._initMetrics();
    }

    _initMetrics() {
        if (this._initialized) return;
        this._initialized = true;

        if (this.registry.setDefaultLabels) {
            this.registry.setDefaultLabels(DEFAULT_LABELS);
        }

        this.ocrReconciliationConflictRate = this._getOrCreateGauge(
            'ocr_reconciliation_conflict_rate',
            'Conflict rate between OCR sources (0-1).',
            ['document_type']
        );
        this.sidecarAvailability = this._getOrCreateGauge(
            'sidecar_availability',
            'Sidecar availability (0-1).',
            ['service']
        );
        this.fieldDetectionF1 = this._getOrCreateGauge(
            'field_detection_f1',
            'Field detection F1 score (0-1).',
            ['document_type']
        );
        this.embeddingQueryLatency = this._getOrCreateHistogram(
            'embedding_query_latency_ms',
            'Embedding query latency (ms).',
            ['query_type'],
            [50, 100, 200, 500, 1000, 2000, 5000]
        );
        this.visualQueryExecutionTime = this._getOrCreateHistogram(
            'visual_query_execution_time_ms',
            'Visual query execution time (ms).',
            ['document_type'],
            [50, 100, 200, 500, 1000, 2000, 5000]
        );
        this.visualQueriesExecutedTotal = this._getOrCreateCounter(
            'visual_queries_executed_total',
            'Total visual queries executed.',
            ['document_type', 'query_type']
        );
        this.visualElementDetectionLatency = this._getOrCreateHistogram(
            'visual_element_detection_latency_ms',
            'Visual element detection latency (ms).',
            ['element_type'],
            [50, 100, 200, 500, 1000, 2000, 5000]
        );
        this.circuitBreakerState = this._getOrCreateGauge(
            'circuit_breaker_state',
            'Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN).',
            ['service']
        );
        this.circuitBreakerTransitionsTotal = this._getOrCreateCounter(
            'circuit_breaker_transitions_total',
            'Circuit breaker state transitions.',
            ['service', 'from_state', 'to_state']
        );
        this.circuitBreakerOpenTotal = this._getOrCreateCounter(
            'circuit_breaker_open_total',
            'Circuit breaker open events.',
            ['service']
        );
        this.visualConfirmationRate = this._getOrCreateGauge(
            'visual_confirmation_rate',
            'Visual confirmation rate (0-1).',
            ['document_type']
        );
        this.ocrSourceAttributionRate = this._getOrCreateGauge(
            'ocr_source_attribution_rate',
            'OCR source attribution rate (0-1).',
            ['document_type', 'source']
        );
        this.extractionAccuracyPerFieldType = this._getOrCreateGauge(
            'extraction_accuracy_per_field_type',
            'Extraction accuracy per field type (0-1).',
            ['field_type']
        );
        this.userCorrectionRate = this._getOrCreateGauge(
            'user_correction_rate',
            'User correction rate (0-1).',
            ['pipeline_id']
        );
        this.visualQueryTimeoutsTotal = this._getOrCreateCounter(
            'visual_query_timeouts_total',
            'Visual query timeouts.',
            ['document_type', 'query_type']
        );
        this.ocrConflictsTotal = this._getOrCreateCounter(
            'ocr_conflicts_total',
            'OCR reconciliation conflicts.',
            ['document_type']
        );
        this.extractionErrorsTotal = this._getOrCreateCounter(
            'extraction_errors_total',
            'Extraction stage errors.',
            ['stage_name']
        );
        this.integrationErrorsTotal = this._getOrCreateCounter(
            'integration_errors_total',
            'Aggregation/integration errors.',
            ['stage_name']
        );
        this.pipelineStageLatency = this._getOrCreateHistogram(
            'pipeline_stage_latency_ms',
            'Pipeline stage latency (ms).',
            ['stage_name', 'stage_type'],
            [50, 100, 200, 500, 1000, 2000, 5000, 10000]
        );
    }

    _getOrCreateMetric(name) {
        if (!this.registry || typeof this.registry.getSingleMetric !== 'function') {
            return null;
        }
        try {
            return this.registry.getSingleMetric(name);
        } catch (error) {
            return null;
        }
    }

    _getOrCreateGauge(name, help, labelNames) {
        const existing = this._getOrCreateMetric(name);
        if (existing) return existing;
        return new client.Gauge({
            name,
            help,
            labelNames,
            registers: [this.registry]
        });
    }

    _getOrCreateCounter(name, help, labelNames) {
        const existing = this._getOrCreateMetric(name);
        if (existing) return existing;
        return new client.Counter({
            name,
            help,
            labelNames,
            registers: [this.registry]
        });
    }

    _getOrCreateHistogram(name, help, labelNames, buckets) {
        const existing = this._getOrCreateMetric(name);
        if (existing) return existing;
        return new client.Histogram({
            name,
            help,
            labelNames,
            buckets,
            registers: [this.registry]
        });
    }

    _safeRun(fn, context) {
        try {
            fn();
        } catch (error) {
            logger.debug({
                event: 'metrics_record_failed',
                context,
                error: error.message
            });
        }
    }

    _normalizeDocumentType(documentType) {
        return documentType ? String(documentType).toLowerCase() : 'unknown';
    }

    _normalizeSource(source) {
        const normalized = source ? String(source).toLowerCase() : 'unknown';
        if (normalized.includes('visual')) return 'visual';
        if (normalized.includes('tesseract') || normalized.includes('paperless')) {
            return 'tesseract';
        }
        if (normalized.includes('fallback')) return 'fallback';
        return normalized;
    }

    recordStageLatency(stageName, stageType, durationMs) {
        if (!Number.isFinite(durationMs)) return;
        const name = stageName || 'unknown';
        const type = stageType || 'unknown';
        this._safeRun(() => {
            this.pipelineStageLatency.labels(name, type).observe(durationMs);
        }, 'pipeline_stage_latency');
    }

    recordOcrConflictRate(documentType, conflictRate) {
        if (!Number.isFinite(conflictRate)) return;
        const docType = this._normalizeDocumentType(documentType);
        const value = Math.max(0, Math.min(1, conflictRate));
        this._safeRun(() => {
            this.ocrReconciliationConflictRate.labels(docType).set(value);
        }, 'ocr_conflict_rate');
        if (conflictRate > 0) {
            this._safeRun(() => {
                this.ocrConflictsTotal.labels(docType).inc();
            }, 'ocr_conflicts_total');
        }
    }

    recordOcrSource(documentType, source) {
        const docType = this._normalizeDocumentType(documentType);
        const normalizedSource = this._normalizeSource(source);
        if (!this._ocrSourceTotals[docType]) {
            this._ocrSourceTotals[docType] = 0;
        }
        if (!this._ocrSourceCounts[docType]) {
            this._ocrSourceCounts[docType] = {};
        }
        this._ocrSourceTotals[docType] += 1;
        this._ocrSourceCounts[docType][normalizedSource] =
            (this._ocrSourceCounts[docType][normalizedSource] || 0) + 1;

        const total = this._ocrSourceTotals[docType];
        const counts = this._ocrSourceCounts[docType];

        this._safeRun(() => {
            Object.entries(counts).forEach(([src, count]) => {
                const rate = total ? count / total : 0;
                this.ocrSourceAttributionRate.labels(docType, src).set(rate);
            });
        }, 'ocr_source_attribution_rate');
    }

    recordSidecarAvailability(service, available) {
        const serviceLabel = service || 'visual-rag';
        const value = available ? 1 : 0;
        this._safeRun(() => {
            this.sidecarAvailability.labels(serviceLabel).set(value);
        }, 'sidecar_availability');
    }

    recordCircuitBreakerState(service, state) {
        const serviceLabel = service || 'unknown';
        const value = CIRCUIT_STATE_VALUES[state] ?? null;
        if (value === null) return;
        this._safeRun(() => {
            this.circuitBreakerState.labels(serviceLabel).set(value);
        }, 'circuit_breaker_state');
    }

    recordCircuitBreakerStateTransition(service, fromState, toState) {
        const serviceLabel = service || 'unknown';
        this._safeRun(() => {
            this.circuitBreakerTransitionsTotal
                .labels(serviceLabel, fromState, toState)
                .inc();
        }, 'circuit_breaker_transitions_total');
        if (toState === 'OPEN') {
            this._safeRun(() => {
                this.circuitBreakerOpenTotal.labels(serviceLabel).inc();
            }, 'circuit_breaker_open_total');
        }
        this.recordCircuitBreakerState(serviceLabel, toState);
    }

    recordCircuitBreakerOperation(service, _type, state) {
        if (!state) return;
        this.recordCircuitBreakerState(service, state);
    }

    observeEmbeddingQueryLatency(queryType, durationMs) {
        if (!Number.isFinite(durationMs)) return;
        const type = queryType || 'unknown';
        this._safeRun(() => {
            this.embeddingQueryLatency.labels(type).observe(durationMs);
        }, 'embedding_query_latency');
    }

    observeVisualQueryExecutionTime(documentType, durationMs) {
        if (!Number.isFinite(durationMs)) return;
        const docType = this._normalizeDocumentType(documentType);
        this._safeRun(() => {
            this.visualQueryExecutionTime.labels(docType).observe(durationMs);
        }, 'visual_query_execution_time');
    }

    incrementVisualQueriesExecuted(documentType, queryType) {
        const docType = this._normalizeDocumentType(documentType);
        const type = queryType || 'unknown';
        this._safeRun(() => {
            this.visualQueriesExecutedTotal.labels(docType, type).inc();
        }, 'visual_queries_executed_total');
    }

    observeVisualElementDetectionLatency(elementType, durationMs) {
        if (!Number.isFinite(durationMs)) return;
        const type = elementType || 'mixed';
        this._safeRun(() => {
            this.visualElementDetectionLatency.labels(type).observe(durationMs);
        }, 'visual_element_detection_latency');
    }

    recordVisualConfirmationRate(documentType, rate) {
        if (!Number.isFinite(rate)) return;
        const docType = this._normalizeDocumentType(documentType);
        const value = Math.max(0, Math.min(1, rate));
        this._safeRun(() => {
            this.visualConfirmationRate.labels(docType).set(value);
        }, 'visual_confirmation_rate');
    }

    recordVisualQueryTimeout(documentType, queryType) {
        const docType = this._normalizeDocumentType(documentType);
        const type = queryType || 'unknown';
        this._safeRun(() => {
            this.visualQueryTimeoutsTotal.labels(docType, type).inc();
        }, 'visual_query_timeouts_total');
    }

    recordExtractionError(stageName) {
        const name = stageName || 'unknown';
        this._safeRun(() => {
            this.extractionErrorsTotal.labels(name).inc();
        }, 'extraction_errors_total');
    }

    recordIntegrationError(stageName) {
        const name = stageName || 'unknown';
        this._safeRun(() => {
            this.integrationErrorsTotal.labels(name).inc();
        }, 'integration_errors_total');
    }

    recordFeedback({ pipelineId, accuracyScore, corrections }) {
        const pipelineKey = pipelineId || 'unknown';
        if (!this._feedbackTotals[pipelineKey]) {
            this._feedbackTotals[pipelineKey] = {
                count: 0,
                accuracySum: 0,
                correctionRateSum: 0
            };
        }
        const totals = this._feedbackTotals[pipelineKey];
        totals.count += 1;

        const accuracy = Number.isFinite(accuracyScore)
            ? Math.max(0, Math.min(1, accuracyScore))
            : null;
        if (accuracy !== null) {
            totals.accuracySum += accuracy;
        }
        const correctionCount = Array.isArray(corrections) ? corrections.length : 0;
        const correctionRate = accuracy !== null ? (1 - accuracy) : (correctionCount > 0 ? 1 : 0);
        totals.correctionRateSum += correctionRate;

        this._safeRun(() => {
            const userRate = totals.count ? totals.correctionRateSum / totals.count : 0;
            this.userCorrectionRate.labels(pipelineKey).set(userRate);

            if (accuracy !== null) {
                const allTotals = Object.values(this._feedbackTotals);
                const totalCount = allTotals.reduce((sum, entry) => sum + entry.count, 0);
                const totalAccuracy = allTotals.reduce((sum, entry) => sum + entry.accuracySum, 0);
                const avgAccuracy = totalCount ? totalAccuracy / totalCount : 0;
                this.fieldDetectionF1.labels('unknown').set(avgAccuracy);
            }
        }, 'feedback_rates');

        if (Array.isArray(corrections)) {
            corrections.forEach((field) => {
                if (!field) return;
                const fieldKey = String(field);
                this._fieldCorrectionCounts[fieldKey] =
                    (this._fieldCorrectionCounts[fieldKey] || 0) + 1;
            });
        }

        this._safeRun(() => {
            const totalFeedback = Object.values(this._feedbackTotals)
                .reduce((sum, entry) => sum + entry.count, 0) || 1;
            Object.entries(this._fieldCorrectionCounts).forEach(([field, count]) => {
                const accuracyPerField = Math.max(0, Math.min(1, 1 - (count / totalFeedback)));
                this.extractionAccuracyPerFieldType.labels(field).set(accuracyPerField);
            });
        }, 'field_accuracy');
    }

    async getMetrics() {
        if (!this.registry || typeof this.registry.metrics !== 'function') {
            return '';
        }
        return await this.registry.metrics();
    }

    get contentType() {
        return this.registry?.contentType || client.register.contentType;
    }
}

const metricsCollector = new PrometheusMetrics();

module.exports = {
    PrometheusMetrics,
    metricsCollector
};
