/**
 * OverlayRefiner.js
 *
 * Uses domain experts to validate and enhance overlay detections
 * with improved labels and confidence scores.
 *
 * Architecture Reference: PROMPT-006 (Expert Overlay Refinement)
 *
 * Refinement Flow:
 * ┌────────────────────────────────────────────────────────────────┐
 * │                      OVERLAY REFINER                           │
 * │                                                                │
 * │  Raw Overlays → Domain Expert Model → Refined Overlays         │
 * │                                                                │
 * │  Improvements:                                                 │
 * │  - More specific labels (signature → physician_signature)      │
 * │  - Confidence adjustment based on domain knowledge             │
 * │  - Validation of detection relevance                           │
 * └────────────────────────────────────────────────────────────────┘
 */

const axios = require('axios');
const logger = require('../logger');
const config = require('../../config/config');

/**
 * Domain expert model mappings
 */
const EXPERT_MODELS = Object.freeze({
    medical: process.env.MEDICAL_ANALYSIS_MODEL || config.expertModels?.medical?.analysis || 'medtext-llama3',
    financial: process.env.FINANCIAL_ANALYSIS_MODEL || config.expertModels?.financial?.analysis || 'fino1-8b',
    legal: process.env.LEGAL_EXPERT_MODEL || config.expertModels?.legal?.analysis || 'dragon-finance:latest'
});

/**
 * Domain-specific label mappings for common refinements
 */
const LABEL_REFINEMENTS = Object.freeze({
    medical: {
        'signature': 'physician_signature',
        'date': 'examination_date',
        'name': 'patient_name',
        'number': 'medical_record_number',
        'address': 'facility_address',
        'table': 'lab_results_table',
        'header': 'clinical_header',
        'stamp': 'medical_facility_stamp'
    },
    financial: {
        'signature': 'authorized_signature',
        'date': 'invoice_date',
        'name': 'company_name',
        'number': 'invoice_number',
        'amount': 'total_amount',
        'table': 'line_items_table',
        'header': 'document_header',
        'stamp': 'company_stamp'
    },
    legal: {
        'signature': 'party_signature',
        'date': 'execution_date',
        'name': 'party_name',
        'number': 'contract_reference',
        'address': 'registered_address',
        'table': 'terms_table',
        'header': 'agreement_header',
        'stamp': 'notary_stamp'
    }
});

class OverlayRefiner {
    constructor(options = {}) {
        this.ollamaClient = options.ollamaClient || axios.create({
            baseURL: config.ollama?.apiUrl || process.env.OLLAMA_HOST || 'http://localhost:11434',
            timeout: options.timeout || 30000
        });

        // Configuration
        this.enableLLMRefinement = options.enableLLMRefinement ?? true;
        this.fallbackToRules = options.fallbackToRules ?? true;
        this.minOverlaysForLLM = options.minOverlaysForLLM || 1;

        // Statistics
        this.stats = {
            refinementsAttempted: 0,
            refinementsSucceeded: 0,
            refinementsFailed: 0,
            fallbacksUsed: 0
        };
    }

    /**
     * Refine overlays using domain expert validation
     * @param {Array} overlays - Raw overlays from OverlayExtractor
     * @param {string} domain - Document domain (medical, financial, legal)
     * @param {Object} context - Additional context (ocrText, documentType)
     * @returns {Promise<Array>} Refined overlays with adjusted confidence/labels
     */
    async refineOverlays(overlays, domain, context = {}) {
        if (!overlays?.length) {
            return overlays || [];
        }

        // No refinement for general domain
        if (domain === 'general') {
            return this._applyRuleBasedRefinements(overlays, 'general');
        }

        this.stats.refinementsAttempted++;

        // Try LLM-based refinement first
        if (this.enableLLMRefinement && overlays.length >= this.minOverlaysForLLM) {
            try {
                const refined = await this._refinewithLLM(overlays, domain, context);
                this.stats.refinementsSucceeded++;
                return refined;
            } catch (error) {
                logger.warn(`[OverlayRefiner] LLM refinement failed: ${error.message}`);
                this.stats.refinementsFailed++;
            }
        }

        // Fallback to rule-based refinement
        if (this.fallbackToRules) {
            this.stats.fallbacksUsed++;
            return this._applyRuleBasedRefinements(overlays, domain);
        }

        return overlays;
    }

    /**
     * Refine overlays using LLM expert
     * @private
     */
    async _refinewithLLM(overlays, domain, context) {
        const model = this._getExpertModel(domain);
        const prompt = this._buildRefinementPrompt(overlays, domain, context);

        const response = await this._callExpert(model, prompt);
        return this._applyLLMRefinements(overlays, response, domain);
    }

    /**
     * Get expert model for domain
     * @private
     */
    _getExpertModel(domain) {
        return EXPERT_MODELS[domain] || config.ollama?.model || 'sauerkraut-llama3.1:8b';
    }

    /**
     * Build refinement prompt for LLM
     * @private
     */
    _buildRefinementPrompt(overlays, domain, context) {
        const overlaysSummary = overlays.map((o, i) => ({
            index: i,
            label: o.label,
            confidence: o.confidence,
            text: o.text?.substring(0, 100)
        }));

        return `You are a ${domain} document expert. Review these detected visual elements from a ${domain} document and refine them.

For each element:
1. Validate if the detection is correct for a ${domain} document
2. Suggest a more specific label if applicable (e.g., "signature" → "${domain === 'medical' ? 'physician_signature' : 'authorized_signature'}")
3. Adjust confidence: +0.1 to +0.2 if clearly correct, -0.1 to -0.3 if uncertain

Detected elements:
${JSON.stringify(overlaysSummary, null, 2)}

Document type: ${context.documentType || 'unknown'}
Text excerpt: ${context.ocrText?.substring(0, 300) || 'N/A'}

Respond with ONLY a JSON array, no explanation:
[{"index": 0, "refined_label": "specific_label", "confidence_adjustment": 0.1, "valid": true}, ...]

Rules:
- Keep index matching the input
- valid=false means the detection is incorrect/irrelevant
- confidence_adjustment range: -0.3 to +0.2
- refined_label should be domain-specific (e.g., patient_name, invoice_number, contract_date)`;
    }

    /**
     * Call Ollama expert model
     * @private
     */
    async _callExpert(model, prompt) {
        const response = await this.ollamaClient.post('/api/generate', {
            model,
            prompt,
            stream: false,
            options: {
                temperature: 0.1,
                num_predict: 1024
            }
        });

        return response.data.response;
    }

    /**
     * Apply LLM refinements to overlays
     * @private
     */
    _applyLLMRefinements(overlays, response, domain) {
        try {
            // Extract JSON array from response
            const jsonMatch = response.match(/\[[\s\S]*?\]/);
            if (!jsonMatch) {
                logger.warn('[OverlayRefiner] No JSON array in LLM response, using fallback');
                return this._applyRuleBasedRefinements(overlays, domain);
            }

            const refinements = JSON.parse(jsonMatch[0]);
            const refinementMap = new Map(refinements.map(r => [r.index, r]));

            return overlays.map((overlay, i) => {
                const refinement = refinementMap.get(i);

                if (!refinement) {
                    // No refinement for this overlay, apply rule-based
                    return this._applyRuleToOverlay(overlay, domain);
                }

                if (!refinement.valid) {
                    // Expert marked as invalid - reduce confidence significantly
                    return {
                        ...overlay,
                        confidence: Math.max(0.1, overlay.confidence * 0.5),
                        refined: true,
                        expertValidated: false,
                        invalidReason: 'Expert marked as incorrect'
                    };
                }

                // Apply expert refinements
                const refinedLabel = refinement.refined_label || overlay.label;
                const adjustedConfidence = Math.min(1, Math.max(0.1,
                    overlay.confidence + (refinement.confidence_adjustment || 0)
                ));

                return {
                    ...overlay,
                    label: refinedLabel,
                    originalLabel: overlay.label,
                    confidence: adjustedConfidence,
                    refined: true,
                    expertValidated: true,
                    refinementSource: 'llm'
                };
            });
        } catch (error) {
            logger.warn(`[OverlayRefiner] Failed to parse LLM refinements: ${error.message}`);
            return this._applyRuleBasedRefinements(overlays, domain);
        }
    }

    /**
     * Apply rule-based refinements (fallback)
     * @private
     */
    _applyRuleBasedRefinements(overlays, domain) {
        return overlays.map(overlay => this._applyRuleToOverlay(overlay, domain));
    }

    /**
     * Apply rule-based refinement to single overlay
     * @private
     */
    _applyRuleToOverlay(overlay, domain) {
        const labelMappings = LABEL_REFINEMENTS[domain] || {};
        const originalLabel = overlay.label?.toLowerCase();

        // Check for direct label mapping
        for (const [pattern, refinedLabel] of Object.entries(labelMappings)) {
            if (originalLabel?.includes(pattern)) {
                return {
                    ...overlay,
                    label: refinedLabel,
                    originalLabel: overlay.label,
                    refined: true,
                    expertValidated: false,
                    refinementSource: 'rules'
                };
            }
        }

        // No rule matched - return with slight confidence boost for domain match
        return {
            ...overlay,
            refined: false,
            expertValidated: false
        };
    }

    /**
     * Get refinement statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            refinementsAttempted: 0,
            refinementsSucceeded: 0,
            refinementsFailed: 0,
            fallbacksUsed: 0
        };
    }
}

// Export singleton and class
const overlayRefiner = new OverlayRefiner();

module.exports = {
    OverlayRefiner,
    overlayRefiner,
    EXPERT_MODELS,
    LABEL_REFINEMENTS
};
