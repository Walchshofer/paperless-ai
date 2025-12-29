/**
 * ExecutionContext
 *
 * Maintains state throughout pipeline execution.
 *
 * Tracks:
 * - Original document data
 * - Classification result
 * - Stage outputs (accumulated)
 * - Errors and recovery attempts
 * - Timing metrics
 */

class ExecutionContext {
    constructor(document, classificationResult, options = {}) {
        this.document = document;
        this.classification = classificationResult;
        this.options = options;

        // Stage outputs keyed by outputKey
        this.stageOutputs = new Map();

        // Execution tracking
        this.stagesExecuted = [];
        this.stagesSkipped = [];
        this.errors = [];
        this.warnings = [];

        // Timing
        this.startTime = Date.now();
        this.stageTimings = new Map();

        // Recovery tracking
        this.recoveryAttempts = 0;
        this.maxRecoveryAttempts = options.maxRecoveryAttempts || 2;
    }

    /**
     * Store output from a completed stage
     */
    setStageOutput(outputKey, output, timing) {
        this.stageOutputs.set(outputKey, output);
        this.stageTimings.set(outputKey, timing);
        this.stagesExecuted.push(outputKey);
    }

    /**
     * Get output from a previous stage
     */
    getStageOutput(outputKey) {
        return this.stageOutputs.get(outputKey);
    }

    /**
     * Record a skipped stage
     */
    skipStage(stageId, reason) {
        this.stagesSkipped.push({ stageId, reason, timestamp: Date.now() });
    }

    /**
     * Record an error
     */
    addError(stageId, error) {
        this.errors.push({
            stageId,
            error: error.message || String(error),
            stack: error.stack,
            timestamp: Date.now()
        });
    }

    /**
     * Record a warning
     */
    addWarning(stageId, message) {
        this.warnings.push({
            stageId,
            message,
            timestamp: Date.now()
        });
    }

    /**
     * Resolve a path like 'stages.medical_visual.output' to actual value
     */
    resolvePath(path) {
        if (!path || typeof path !== 'string') {
            return null;
        }

        // Special handling for enhanced_ocr_text with Paperless OCR fallback
        // This ensures downstream stages always get text even if visual OCR failed
        if (path === 'document.enhanced_ocr_text') {
            return this.document.extraction_text ||
                this.document.enhanced_ocr_text ||
                this.document.ocr_text ||
                '';
        }

        const parts = path.split('.');
        let current = null;

        // Handle different path roots
        switch (parts[0]) {
            case 'document':
                current = this.document;
                parts.shift();
                break;
            case 'classification':
                current = this.classification;
                parts.shift();
                break;
            case 'context':
                current = this.options.context || {};
                parts.shift();
                break;
            case 'stages':
                // stages.stage_id.output -> get from stageOutputs
                if (parts.length >= 3 && parts[2] === 'output') {
                    const stageOutputKey = this._findOutputKeyForStage(parts[1]);
                    return this.stageOutputs.get(stageOutputKey);
                }
                return null;
            case 'routing':
                current = this.classification?.routing || {};
                parts.shift();
                break;
            default:
                return null;
        }

        // Navigate remaining path
        for (const part of parts) {
            if (current === null || current === undefined) {
                return null;
            }
            current = current[part];
        }

        return current;
    }

    /**
     * Find the outputKey for a stage by its id
     */
    _findOutputKeyForStage(stageId) {
        // This requires knowledge of the pipeline stages
        // For now, use convention that outputKey often matches stage purpose
        const conventions = {
            'medical_visual': 'imaging_analysis',
            'medical_text': 'text_extraction',
            'medical_integration': 'integrated_record',
            'medical_validation': 'validation_result',
            'medical_recovery': 'recovery_extraction',
            'financial_visual': 'visual_analysis',
            'financial_extraction': 'financial_extraction',
            'financial_reasoning': 'financial_reasoning',
            'financial_vat_expert': 'financial_vat_analysis',
            'legal_extraction': 'legal_extraction',
            'general_classifier': 'general_classification',
            'general_extraction': 'general_extraction'
        };
        return conventions[stageId] || stageId;
    }

    /**
     * Get execution summary
     */
    getSummary() {
        return {
            totalTimeMs: Date.now() - this.startTime,
            stagesExecuted: this.stagesExecuted.length,
            stagesSkipped: this.stagesSkipped.length,
            errorCount: this.errors.length,
            warningCount: this.warnings.length,
            recoveryAttempts: this.recoveryAttempts
        };
    }

    /**
     * Get all stage outputs as plain object
     */
    getAllOutputs() {
        const outputs = {};
        for (const [key, value] of this.stageOutputs) {
            outputs[key] = value;
        }
        return outputs;
    }
}

module.exports = { ExecutionContext };
