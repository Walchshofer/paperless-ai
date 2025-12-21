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

    finalize() {
        this.telemetry.totalDurationMs = Date.now() - this.startTime;
        return this.telemetry;
    }
}

module.exports = TelemetryCollector;
