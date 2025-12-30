/**
 * toolingConfig.js
 *
 * Tool orchestration configuration resolver.
 * Handles tool allowlisting, pre-vision and post-analysis phase configuration.
 */

const config = require('../../../config/config');
const { normalizeBoolean } = require('./normalizers');
const { paperlessApiTools } = require('../../tools');

const ORCHESTRATOR_TOOL_PHASES = Object.freeze({
    PRE_VISION: 'pre_vision',
    POST_ANALYSIS: 'post_analysis'
});

const NORMALIZATION_TOOL_NAME = 'paperless.normalize_images';

const DEFAULT_PRE_VISION_TOOL_ALLOWLIST = new Set([
    NORMALIZATION_TOOL_NAME
]);

const DEFAULT_POST_ANALYSIS_TOOL_ALLOWLIST = new Set([
    'paperless.update_document',
    'paperless.bulk_edit_documents',
    'paperless.resolve_tags',
    'paperless.resolve_correspondent',
    'paperless.resolve_document_type',
    'paperless.list_tags',
    'paperless.list_correspondents',
    'paperless.list_document_types',
    'paperless.list_storage_paths'
]);

const TOOL_DOCUMENT_ID_KEYS = new Map([
    ['paperless.update_document', 'document_id'],
    ['paperless.bulk_edit_documents', 'document_ids'],
    [NORMALIZATION_TOOL_NAME, 'document_id']
]);

/**
 * Resolve tooling configuration from options and global config
 * @param {Object} options - User-provided options
 * @returns {Object} Resolved tooling configuration
 */
function resolveToolingConfig(options = {}) {
    const orchestrationConfig = config.orchestration || {};

    const enabled = normalizeBoolean(
        options.orchestrationToolsEnabled,
        normalizeBoolean(orchestrationConfig.toolsEnabled, false)
    );

    const preVisionEnabled = normalizeBoolean(
        options.orchestrationPreVisionToolsEnabled,
        normalizeBoolean(orchestrationConfig.preVisionToolsEnabled, enabled)
    );

    const postAnalysisEnabled = normalizeBoolean(
        options.orchestrationPostAnalysisToolsEnabled,
        normalizeBoolean(orchestrationConfig.postAnalysisToolsEnabled, enabled)
    );

    const preVisionNormalizationEnabled = normalizeBoolean(
        options.orchestrationPreVisionNormalizationEnabled,
        normalizeBoolean(orchestrationConfig.preVisionNormalizationEnabled, preVisionEnabled)
    );

    const failOnError = normalizeBoolean(
        options.orchestrationFailOnToolError,
        normalizeBoolean(orchestrationConfig.failOnToolError, false)
    );

    const allowlist = Array.isArray(orchestrationConfig.toolAllowlist)
        ? orchestrationConfig.toolAllowlist
        : null;

    return {
        enabled,
        preVisionEnabled,
        postAnalysisEnabled,
        preVisionNormalizationEnabled,
        failOnError,
        allowlist
    };
}

/**
 * Resolve tool allowlist for specific phase
 * @param {Object} toolingConfig - Resolved tooling config
 * @param {string} phase - Orchestrator phase
 * @returns {Set<string>} Set of allowed tool names
 */
function resolveToolAllowlist(toolingConfig, phase) {
    const baseAllowlist = phase === ORCHESTRATOR_TOOL_PHASES.PRE_VISION
        ? DEFAULT_PRE_VISION_TOOL_ALLOWLIST
        : DEFAULT_POST_ANALYSIS_TOOL_ALLOWLIST;

    if (!Array.isArray(toolingConfig.allowlist) || toolingConfig.allowlist.length === 0) {
        return new Set(baseAllowlist);
    }

    const configured = new Set(
        toolingConfig.allowlist.map(name => String(name).trim()).filter(Boolean)
    );

    return new Set([...baseAllowlist].filter(name => configured.has(name)));
}

/**
 * Get all allowed tool definitions across all phases
 * @param {Object} toolingConfig - Resolved tooling config
 * @returns {Array<Object>} Array of allowed tool definitions
 */
function getAllowedToolDefinitions(toolingConfig) {
    const preVisionAllowlist = resolveToolAllowlist(
        toolingConfig,
        ORCHESTRATOR_TOOL_PHASES.PRE_VISION
    );

    const postAnalysisAllowlist = resolveToolAllowlist(
        toolingConfig,
        ORCHESTRATOR_TOOL_PHASES.POST_ANALYSIS
    );

    const combined = new Set([...preVisionAllowlist, ...postAnalysisAllowlist]);

    return paperlessApiTools.listPaperlessTools().filter(tool => combined.has(tool.name));
}

module.exports = {
    ORCHESTRATOR_TOOL_PHASES,
    NORMALIZATION_TOOL_NAME,
    DEFAULT_PRE_VISION_TOOL_ALLOWLIST,
    DEFAULT_POST_ANALYSIS_TOOL_ALLOWLIST,
    TOOL_DOCUMENT_ID_KEYS,
    resolveToolingConfig,
    resolveToolAllowlist,
    getAllowedToolDefinitions
};