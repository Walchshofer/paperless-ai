const config = require('../config/config');

/**
 * Centralized registry for domain expert pipelines.
 * Experts are additive to the general extraction flow.
 */
class ExpertRegistry {
    constructor() {
        this.experts = new Map();
        this._registerDefaults();
    }

    _registerDefaults() {
        const medicalModels = config.expertModels?.medical || {};
        const financialModels = config.expertModels?.financial || {};
        const legalModels = config.expertModels?.legal || {};

        this.register({
            domain: 'medical',
            status: 'active',
            models: {
                vision: medicalModels.vision || 'qwen3-vl:8b',
                analysis: medicalModels.analysis || 'medtext-llama3',
                radiology: medicalModels.radiology || 'llava-med-v1.5',
                recovery: config.ollama?.model || 'gpt-oss:latest'
            },
            triggers: {
                categories: ['medical'],
                keywords: ['befund', 'labor', 'blutbild', 'arztbrief', 'laborwerte', 'hba1c', 'cholesterin'],
                modalities: ['lab', 'radiology', 'prescription']
            },
            pipeline: [
                {
                    stage: 'ocr',
                    model: 'vision',
                    when: (ctx) => ctx.modality !== 'radiology',
                    input: 'image',
                    output: 'markdown',
                    promptBuilder: 'buildOcrTranscriptionPrompt'
                },
                {
                    stage: 'analysis',
                    model: 'analysis',
                    when: (ctx) => ctx.modality === 'lab',
                    input: 'markdown',
                    output: 'json',
                    promptBuilder: 'buildMedicalAnalysisPrompt'
                },
                {
                    stage: 'reasoning',
                    model: 'radiology',
                    when: (ctx) => ctx.modality === 'radiology',
                    input: 'image',
                    output: 'json',
                    promptBuilder: 'buildRadiologyVisionPrompt'
                },
                {
                    stage: 'recovery',
                    model: 'recovery',
                    when: (ctx) => ctx.missingFields?.length > 0,
                    input: 'text',
                    output: 'json',
                    promptBuilder: 'buildFieldRecoveryPrompt'
                }
            ]
        });

        this.register({
            domain: 'financial',
            status: 'planned',
            models: {
                vision: financialModels.vision || null,
                analysis: financialModels.analysis || null
            },
            triggers: {
                categories: ['financial'],
                keywords: ['rechnung', 'invoice', 'bank', 'zahlung'],
                modalities: ['invoice', 'statement', 'receipt']
            },
            pipeline: []
        });

        this.register({
            domain: 'legal',
            status: 'planned',
            models: {
                vision: legalModels.vision || null,
                analysis: legalModels.analysis || null
            },
            triggers: {
                categories: ['legal'],
                keywords: ['vertrag', 'contract', 'vereinbarung', 'bescheid'],
                modalities: ['contract', 'agreement', 'notice']
            },
            pipeline: []
        });
    }

    register(expert) {
        if (!expert.domain) {
            throw new Error('Expert must have a domain');
        }
        this.experts.set(expert.domain, expert);
        console.log(`[EXPERT_REGISTRY] Registered expert: ${expert.domain} (${expert.status})`);
    }

    get(domain) {
        return this.experts.get(domain);
    }

    isActive(domain) {
        const expert = this.experts.get(domain);
        return expert?.status === 'active';
    }

    getActiveExperts() {
        return Array.from(this.experts.values()).filter(e => e.status === 'active');
    }

    getPlannedExperts() {
        return Array.from(this.experts.values()).filter(e => e.status === 'planned');
    }

    getAllDomains() {
        return Array.from(this.experts.keys());
    }

    /**
     * Get applicable pipeline stages for a context
     * @param {string} domain - Expert domain
     * @param {Object} context - Execution context (modality, missingFields, etc.)
     * @returns {Array} Applicable pipeline stages
     */
    getApplicableStages(domain, context) {
        const expert = this.experts.get(domain);
        if (!expert || expert.status !== 'active') {
            return [];
        }

        return expert.pipeline.filter(stage => {
            if (typeof stage.when === 'function') {
                return stage.when(context);
            }
            return true;
        });
    }

    /**
     * Get model name for a stage
     * @param {string} domain - Expert domain
     * @param {string} modelKey - Model key (vision, analysis, radiology, recovery)
     * @returns {string|null} Model name or null
     */
    getModel(domain, modelKey) {
        const expert = this.experts.get(domain);
        return expert?.models?.[modelKey] || null;
    }

    /**
     * Check if expert should trigger based on planner result
     * @param {Object} plannerResult - Planner classification result
     * @returns {Object|null} Matching expert or null
     */
    matchExpert(plannerResult) {
        const category = plannerResult?.category?.toLowerCase();

        for (const expert of this.experts.values()) {
            if (expert.status !== 'active') continue;

            if (expert.triggers.categories.includes(category)) {
                return expert;
            }

            const keywords = plannerResult?.keywords || [];
            const hasKeywordMatch = keywords.some(kw =>
                expert.triggers.keywords.some(trigger =>
                    kw.toLowerCase().includes(trigger.toLowerCase())
                )
            );

            if (hasKeywordMatch) {
                return expert;
            }
        }

        return null;
    }

    /**
     * Get registry status summary
     * @returns {Object} Status summary
     */
    getStatus() {
        const status = {};
        for (const [domain, expert] of this.experts) {
            status[domain] = {
                status: expert.status,
                models: Object.keys(expert.models).filter(k => expert.models[k]),
                pipelineStages: expert.pipeline.length
            };
        }
        return status;
    }
}

module.exports = new ExpertRegistry();
