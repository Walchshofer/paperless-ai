/**
 * guidance.js
 *
 * Guidance service integration utilities.
 * Handles template resolution and version management for deterministic extraction.
 */

const config = require('../../../config/config');

const GUIDANCE_TAG_SCHEMA_VERSION = String(
    process.env.GUIDANCE_TAG_SCHEMA_VERSION ||
    config.guidanceService?.tagSchemaVersion ||
    'v1'
).toLowerCase();

const USE_GUIDANCE_TAG_SCHEMA_V2 = ['v2', '2', 'true', 'yes'].includes(
    GUIDANCE_TAG_SCHEMA_VERSION
);

const GUIDANCE_V2_TEMPLATE_MAP = {
    medical_integrator: 'medical_integrator_v2',
    financial_extractor: 'financial_extractor_v2',
    financial_reasoner: 'financial_reasoner_v2',
    legal_extractor: 'legal_extractor_v2',
    general_extractor: 'general_extractor_v2'
};

/**
 * Resolve Guidance template name, applying v2 mapping if enabled
 * @param {string} templateName - Original template name
 * @returns {string} Resolved template name
 */
function resolveGuidanceTemplateName(templateName) {
    if (!templateName || !USE_GUIDANCE_TAG_SCHEMA_V2) {
        return templateName;
    }
    return GUIDANCE_V2_TEMPLATE_MAP[templateName] || templateName;
}

module.exports = {
    GUIDANCE_TAG_SCHEMA_VERSION,
    USE_GUIDANCE_TAG_SCHEMA_V2,
    GUIDANCE_V2_TEMPLATE_MAP,
    resolveGuidanceTemplateName
};
