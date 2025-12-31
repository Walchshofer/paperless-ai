const config = require('../../../config/config');
const logger = require('../../logger');
const { DomainType } = require('../../prompts/PromptRegistry');

class SemanticRouter {
    constructor(options = {}) {
        this.config = options.config || config.semanticRouter || {};
        const enabledRaw = options.enabled ?? this.config.enabled ?? false;
        this.enabled = this._normalizeEnabled(enabledRaw);
        this.minConfidence = this.config.minConfidence ?? 0.6;
        this.costWeights = this.config.costWeights || {
            expert: 1.0,
            general: 0.5,
            router: 0.2
        };
    }

    selectPipeline(classificationResult, candidatePipelines = []) {
        if (!candidatePipelines.length) {
            return null;
        }
        const classification = classificationResult?.classification || classificationResult || {};
        // Validate classification
        if (!classification || typeof classification !== 'object' || !classification.primary_domain) {
            logger && logger.warn && logger.warn({
                event: 'semantic_router_invalid_classification',
                classification: classificationResult
            });
            const general = candidatePipelines.find(p => p.domain === DomainType.GENERAL);
            return general || candidatePipelines[0];
        }
        const domain = classification.primary_domain || 'General';
        const confidence = Number(classification.confidence ?? 0);

        const domainEnum = this._mapDomain(domain);

        const scored = candidatePipelines.map((pipeline) => {
            const domainScore = pipeline.domain === domainEnum ? 1 : 0;
            const confidenceScore = Math.min(Math.max(confidence, 0), 1);
            const costScore = this._costScoreForPipeline(pipeline);

            return {
                pipeline,
                score: (domainScore * 0.6) + (confidenceScore * 0.3) + (costScore * 0.1)
            };
        });

        scored.sort((a, b) => b.score - a.score);

        if (confidence < this.minConfidence) {
            const general = scored.find(({ pipeline }) => pipeline.domain === DomainType.GENERAL);
            return general ? general.pipeline : scored[0].pipeline;
        }

        return scored[0].pipeline;
    }

    /**
     * Select pipeline but provide graceful fallback when router or model is unavailable.
     * @param {Object} classificationResult
     * @param {Array} candidatePipelines
     * @param {Object} options - { modelAvailable: boolean, routerFailed: boolean }
     * @returns {Object} selected pipeline. If fallback applied, returns pipeline augmented with _meta.
     */
    selectPipelineWithFallback(classificationResult, candidatePipelines = [], options = {}) {
        const { modelAvailable = true, routerFailed = false } = options;

        if (routerFailed || modelAvailable === false) {
            logger && logger.warn && logger.warn({
                event: 'semantic_router_forced_fallback',
                reason: routerFailed ? 'router_failed' : 'model_unavailable'
            });

            const general = candidatePipelines.find(p => p.domain === DomainType.GENERAL) || candidatePipelines[0];
            // Attach fallback metadata to make caller aware
            const wrapped = Object.assign({}, general);
            wrapped._meta = { fallback: true, reason: 'router_unavailable' };
            return wrapped;
        }

        return this.selectPipeline(classificationResult, candidatePipelines);
    }

    _costScoreForPipeline(pipeline) {
        const tier = pipeline?.costTier || this._inferTier(pipeline);
        const weight = this.costWeights[tier] ?? 0.5;
        return Math.min(Math.max(weight, 0), 1);
    }

    _inferTier(pipeline) {
        if (pipeline?.domain === DomainType.GENERAL) {
            return 'general';
        }
        return 'expert';
    }

    _mapDomain(domain) {
        const normalized = String(domain || '').toLowerCase();
        if (normalized === 'medical') return DomainType.MEDICAL;
        if (normalized === 'financial') return DomainType.FINANCIAL;
        if (normalized === 'legal') return DomainType.LEGAL;
        return DomainType.GENERAL;
    }

    _normalizeEnabled(value) {
        if (typeof value === 'string') {
            return value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
        }
        return value === true;
    }
}

module.exports = SemanticRouter;
