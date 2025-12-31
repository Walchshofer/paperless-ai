/**
 * Collects structured telemetry for extraction stages and routing decisions.
 */
class TelemetryCollector {
    constructor(documentId) {
        this.startTime = Date.now();
        this.telemetry = {
            documentId,
            timestamp: new Date().toISOString(),
            totalDurationMs: 0,
            stages: [],
            routing: {},
            extraction: {},
            validation: {}
        };
    }

    startStage(name, model) {
        return { name, model, start: Date.now() };
    }

    endStage(stage, success = true) {
        if (!stage) return;
        const durationMs = Date.now() - stage.start;
        this.telemetry.stages.push({
            name: stage.name,
            model: stage.model,
            durationMs,
            success: !!success
        });
    }

    setRouting(routing, fallbackTriggered = false, fallbackReason = null) {
        if (!routing) return;
        this.telemetry.routing = {
            category: routing.category,
            confidence: routing.confidence,
            modality: routing.modality,
            expertPipeline: routing.expertPipeline,
            fallbackTriggered,
            fallbackReason
        };
    }

    setExtractionStats(fieldsRequested, fieldsExtracted, fieldsMissing, lowConfidenceFields) {
        this.telemetry.extraction = {
            fieldsRequested,
            fieldsExtracted,
            fieldsMissing,
            lowConfidenceFields
        };
    }

    setValidation(score, passed) {
        this.telemetry.validation = {
            score,
            passed
        };
    }

    setNormalization(metadata) {
        if (!metadata) return;
        this.telemetry.normalization = {
            requested: metadata.requested || 0,
            executed: metadata.executed || 0,
            succeeded: metadata.succeeded || 0,
            changesDetected: metadata.changes_detected || false,
            reingested: metadata.reingested || false,
            actionsApplied: metadata.actions_applied || [],
            warnings: metadata.warnings || []
        };
    }

    getNormalizationRate() {
        const norm = this.telemetry.normalization;
        if (!norm || norm.requested === 0) return 0;
        return norm.executed / norm.requested;
    }

    getChangeDetectionRate() {
        const norm = this.telemetry.normalization;
        if (!norm || norm.executed === 0) return 0;
        return norm.changesDetected ? 1 : 0;
    }

    finalize() {
        this.telemetry.totalDurationMs = Date.now() - this.startTime;
        return this.telemetry;
    }
}

module.exports = TelemetryCollector;
