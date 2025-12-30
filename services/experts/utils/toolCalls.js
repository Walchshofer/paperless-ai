
/**
 * toolCalls.js
 *
 * Tool call normalization and execution planning.
 * Handles parsing and normalization of tool calls from LLM responses.
 */

/**
 * Normalize raw tool calls from LLM response
 * @param {Array} rawCalls - Raw tool calls from LLM
 * @returns {Array<Object>} Normalized tool calls
 */
function normalizeToolCalls(rawCalls) {
    if (!Array.isArray(rawCalls)) {
        return [];
    }

    return rawCalls.map(call => {
        if (!call || typeof call !== 'object') {
            return null;
        }

        const tool = String(call.tool || call.name || call.tool_name || '').trim();
        if (!tool) {
            return null;
        }

        const input = (call.input && typeof call.input === 'object')
            ? call.input
            : (call.arguments && typeof call.arguments === 'object')
                ? call.arguments
                : {};

        const reason = call.reason || call.purpose || call.description || null;

        return { tool, input, reason };
    }).filter(Boolean);
}

/**
 * Extract tool plan from orchestration response
 * @param {Object} orchestrationPlan - Orchestration response
 * @returns {Object} Extracted tool plan with pre_vision and post_analysis phases
 */
function extractToolPlan(orchestrationPlan) {
    if (!orchestrationPlan || typeof orchestrationPlan !== 'object') {
        return { plan: { pre_vision: [], post_analysis: [] } };
    }

    const rawPlan = orchestrationPlan.tool_plan || orchestrationPlan.toolPlan || {};

    const preVision = normalizeToolCalls(
        rawPlan.pre_vision
        || rawPlan.preVision
        || orchestrationPlan.pre_vision
        || orchestrationPlan.preVision
    );

    const postAnalysis = normalizeToolCalls(
        rawPlan.post_analysis
        || rawPlan.postAnalysis
        || orchestrationPlan.post_analysis
        || orchestrationPlan.postAnalysis
    );

    return { plan: { pre_vision: preVision, post_analysis: postAnalysis } };
}

/**
 * Apply document ID defaults to tool input
 * @param {string} toolName - Tool name
 * @param {Object} input - Tool input
 * @param {Object} document - Document object
 * @returns {Object} Result with prepared input and missing flag
 */
function applyDocumentIdDefaults(toolName, input, document) {
    const { TOOL_DOCUMENT_ID_KEYS } = require('./toolingConfig');

    const documentIdKey = TOOL_DOCUMENT_ID_KEYS.get(toolName);
    const preparedInput = (input && typeof input === 'object') ? { ...input } : {};

    if (!documentIdKey) {
        return { input: preparedInput, missingDocumentId: false };
    }

    if (preparedInput[documentIdKey] !== undefined && preparedInput[documentIdKey] !== null) {
        return { input: preparedInput, missingDocumentId: false };
    }

    const docId = document?.id;
    if (!docId) {
        return { input: preparedInput, missingDocumentId: true };
    }

    preparedInput[documentIdKey] = docId;
    return { input: preparedInput, missingDocumentId: false };
}

module.exports = {
    normalizeToolCalls,
    extractToolPlan,
    applyDocumentIdDefaults
};
