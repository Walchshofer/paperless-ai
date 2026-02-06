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

    setSuggestions(suggestionsMetadata) {
        if (!suggestionsMetadata) return;
        this.telemetry.suggestions = {
            generated: suggestionsMetadata.generated || 0,
            accepted: suggestionsMetadata.accepted || 0,
            acceptanceRate: suggestionsMetadata.acceptanceRate || 0,
            byType: suggestionsMetadata.byType || {},
            totalSuggestions: suggestionsMetadata.totalSuggestions || 0,
            missingRequired: suggestionsMetadata.missingRequired || 0,
            relatedOptional: suggestionsMetadata.relatedOptional || 0
        };
    }

    setCacheStats(cacheMetadata) {
        if (!cacheMetadata) return;
        this.telemetry.cache = {
            hits: cacheMetadata.hits || 0,
            misses: cacheMetadata.misses || 0,
            hitRate: cacheMetadata.hitRate || 0,
            enabled: cacheMetadata.enabled || false,
            latencyReduction: cacheMetadata.latencyReduction || 0
        };
    }

    getCacheHitRate() {
        const cache = this.telemetry.cache;
        if (!cache || !cache.enabled) return 0;
        return cache.hitRate;
    }

    /**
     * Set background job statistics
     * @param {Object} jobMetadata - Job processing metadata
     */
    setJobStats(jobMetadata) {
        if (!jobMetadata) return;
        this.telemetry.backgroundJob = {
            jobId: jobMetadata.jobId,
            documentId: jobMetadata.documentId,
            status: jobMetadata.status, // 'completed', 'failed', 'retrying'
            pagesIndexed: jobMetadata.pagesIndexed || 0,
            duration: jobMetadata.duration || 0,
            attempt: jobMetadata.attempt || 1,
            error: jobMetadata.error || null
        };
    }

    /**
     * Get background job statistics
     * @returns {Object} Job stats
     */
    getJobStats() {
        return this.telemetry.backgroundJob || {
            jobId: null,
            documentId: null,
            status: 'unknown',
            pagesIndexed: 0,
            duration: 0,
            attempt: 1,
            error: null
        };
    }

    getSuggestionAcceptanceRate() {
        const sugg = this.telemetry.suggestions;
        if (!sugg || sugg.generated === 0) return 0;
        return sugg.accepted / sugg.generated;
    }

    getSuggestionStats() {
        return this.telemetry.suggestions || {
            generated: 0,
            accepted: 0,
            acceptanceRate: 0,
            byType: {},
            totalSuggestions: 0,
            missingRequired: 0,
            relatedOptional: 0
        };
    }

    finalize() {
        this.telemetry.totalDurationMs = Date.now() - this.startTime;
        return this.telemetry;
    }
}

module.exports = TelemetryCollector;
