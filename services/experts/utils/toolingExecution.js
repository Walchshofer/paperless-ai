/**
 * toolingExecution.js
 *
 * Tool call execution orchestration.
 * Executes tool calls with validation, error handling, and normalization tracking.
 */

const logger = require('../../logger');
const { paperlessApiTools } = require('../../tools');
const {
    ORCHESTRATOR_TOOL_PHASES,
    NORMALIZATION_TOOL_NAME,
    resolveToolAllowlist
} = require('./toolingConfig');
const { applyDocumentIdDefaults } = require('./toolCalls');

/**
 * Reasons that require human review when tools are skipped
 * These represent problematic situations (not configuration choices)
 */
const REVIEW_SKIP_REASONS = Object.freeze({
    TOOL_NOT_ALLOWED: 'tool_not_allowed',
    INVALID_TOOL_CALL: 'invalid_tool_call',
    MISSING_DOCUMENT_ID: 'missing_document_id',
    UNKNOWN_TOOL: 'unknown_tool'
});

/**
 * Check if a skip reason requires human review
 * Only certain skip reasons indicate problems that need manual intervention
 * Configuration-based skips (like tooling_disabled) do not require review
 *
 * @param {string} reason - Skip reason
 * @returns {boolean} True if reason requires human review
 */
function requiresHumanReview(reason) {
    return Object.values(REVIEW_SKIP_REASONS).includes(reason);
}

/**
 * Build normalization metadata from tool execution summary
 * @param {Object} summary - Tool execution summary
 * @returns {Object|null} Normalization metadata
 */
function buildNormalizationMetadata(summary) {
    if (!summary || summary.phase !== ORCHESTRATOR_TOOL_PHASES.PRE_VISION) {
        return null;
    }

    const actions = summary.results.map(result => ({
        tool: result.tool,
        ok: result.ok,
        input: result.input,
        data: result.data || null
    }));

    return {
        requested: summary.requested,
        executed: summary.executed,
        succeeded: summary.results.filter(result => result.ok).length,
        actions,
        skipped: summary.skipped,
        details: summary.normalizationMetadata || null,
        normalization_is_final: summary.normalizationIsFinal
    };
}

/**
 * Attach tool execution summary to orchestration plan
 * @param {Object} orchestrationPlan - Orchestration plan
 * @param {Object} summary - Tool execution summary
 * @returns {Object} Updated orchestration plan
 */
function attachToolingSummary(orchestrationPlan, summary) {
    if (!orchestrationPlan || typeof orchestrationPlan !== 'object' || !summary) {
        return orchestrationPlan;
    }

    const tooling = (orchestrationPlan.tooling && typeof orchestrationPlan.tooling === 'object')
        ? { ...orchestrationPlan.tooling }
        : {};

    tooling.enabled = summary.enabled;
    tooling.allowlist = summary.allowlist;
    tooling[summary.phase] = summary;

    if (summary.requires_human_review) {
        tooling.requires_human_review = true;
    }

    tooling.updated_at = new Date().toISOString();

    return {
        ...orchestrationPlan,
        tooling
    };
}

/**
 * Execute tool calls for a specific phase
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Execution summary
 */
async function executeToolCalls({
    phase,
    calls,
    document,
    toolingConfig
}) {
    const allowlist = resolveToolAllowlist(toolingConfig, phase);

    const enabled = toolingConfig.enabled
        && (phase === ORCHESTRATOR_TOOL_PHASES.PRE_VISION
            ? toolingConfig.preVisionEnabled
            : toolingConfig.postAnalysisEnabled);

    const summary = {
        phase,
        enabled,
        requested: Array.isArray(calls) ? calls.length : 0,
        executed: 0,
        results: [],
        skipped: [],
        allowlist: Array.from(allowlist),
        failed: false,
        failPipeline: false,
        requires_human_review: false,
        normalizedImages: null,
        normalizedImageData: null,
        normalizationMetadata: null,
        normalizationToolIndex: null,
        normalizationIsFinal: false
    };

    const reviewSkips = [];

    if (!enabled) {
        if (summary.requested > 0) {
            summary.skipped.push({
                reason: 'tooling_disabled',
                count: summary.requested
            });
        }
        return summary;
    }

    for (const call of calls || []) {
        if (!call || !call.tool) {
            const skipReason = REVIEW_SKIP_REASONS.INVALID_TOOL_CALL;
            const skip = { reason: skipReason, tool: call?.tool || null };
            summary.skipped.push(skip);
            logger.info({
                event: 'action_reverted',
                action_type: call?.tool || 'unknown',
                revert_reason: skipReason
            });

            if (requiresHumanReview(skipReason)) {
                reviewSkips.push(skip);
            }
            continue;
        }

        logger.info({
            event: 'action_proposed',
            action_type: call.tool,
            confidence: call.confidence ?? null,
            evidence_refs: call.evidence_refs ?? [],
            policy_checks: {
                allowlisted: allowlist.has(call.tool),
                enabled,
                phase
            }
        });

        if (!allowlist.has(call.tool)) {
            const skipReason = REVIEW_SKIP_REASONS.TOOL_NOT_ALLOWED;
            const skip = { reason: skipReason, tool: call.tool };
            summary.skipped.push(skip);
            logger.info({
                event: 'action_reverted',
                action_type: call.tool,
                revert_reason: skipReason
            });

            if (requiresHumanReview(skipReason)) {
                reviewSkips.push(skip);
            }
            continue;
        }

        if (call.tool === NORMALIZATION_TOOL_NAME &&
            toolingConfig.preVisionNormalizationEnabled === false) {
            const skipReason = 'normalization_disabled';
            const skip = { reason: skipReason, tool: call.tool };
            summary.skipped.push(skip);
            logger.info({
                event: 'action_reverted',
                action_type: call.tool,
                revert_reason: skipReason
            });

            // normalization_disabled is a configuration choice, not a review-worthy problem
            if (requiresHumanReview(skipReason)) {
                reviewSkips.push(skip);
            }
            continue;
        }

        if (!paperlessApiTools.getPaperlessToolDefinition(call.tool)) {
            const skipReason = REVIEW_SKIP_REASONS.UNKNOWN_TOOL;
            const skip = { reason: skipReason, tool: call.tool };
            summary.skipped.push(skip);
            logger.info({
                event: 'action_reverted',
                action_type: call.tool,
                revert_reason: skipReason
            });

            if (requiresHumanReview(skipReason)) {
                reviewSkips.push(skip);
            }
            continue;
        }

        const { input: preparedInput, missingDocumentId } = applyDocumentIdDefaults(
            call.tool,
            call.input,
            document
        );

        if (missingDocumentId) {
            const skipReason = REVIEW_SKIP_REASONS.MISSING_DOCUMENT_ID;
            const skip = { reason: skipReason, tool: call.tool };
            summary.skipped.push(skip);
            logger.info({
                event: 'action_reverted',
                action_type: call.tool,
                revert_reason: skipReason
            });

            if (requiresHumanReview(skipReason)) {
                reviewSkips.push(skip);
            }
            continue;
        }

        const startTime = Date.now();
        const outcome = await paperlessApiTools.executePaperlessTool(
            call.tool,
            preparedInput
        );
        const durationMs = Date.now() - startTime;
        const resultIndex = summary.results.length;

        const result = {
            tool: call.tool,
            input: preparedInput,
            ok: outcome.ok,
            data: outcome.data || null,
            error: outcome.error || null,
            duration_ms: durationMs,
            reason: call.reason || null,
            index: resultIndex
        };

        if (call.tool === NORMALIZATION_TOOL_NAME && outcome.ok && outcome.data) {
            const { base64Images, image_data, metadata } = outcome.data;
            if (Array.isArray(base64Images) && base64Images.length > 0) {
                summary.normalizedImages = base64Images;
                summary.normalizedImageData = image_data || base64Images[0];
                summary.normalizationMetadata = metadata || null;
                summary.normalizationToolIndex = resultIndex;
                result.data = metadata || null;
            }
        }

        summary.results.push(result);
        summary.executed += 1;

        if (outcome.ok) {
            logger.info({
                event: 'orchestrator_tool_executed',
                phase,
                tool: call.tool,
                documentId: document?.id,
                durationMs
            });
            logger.info({
                event: 'action_executed',
                action_type: call.tool,
                execution_time_ms: durationMs,
                result_status: 'success'
            });
        } else {
            logger.warn({
                event: 'orchestrator_tool_failed',
                phase,
                tool: call.tool,
                documentId: document?.id,
                durationMs,
                error: outcome.error
            });
            logger.info({
                event: 'action_failed',
                action_type: call.tool,
                error: outcome.error
            });
        }
    }

    summary.failed = summary.results.some(result => !result.ok);
    summary.failPipeline = summary.failed && toolingConfig.failOnError;

    // Human review required if: execution failed OR review-worthy skips occurred
    summary.requires_human_review = summary.failed || reviewSkips.length > 0;

    if (summary.normalizationToolIndex !== null) {
        summary.normalizationIsFinal = summary.normalizationToolIndex === summary.results.length - 1;
    }

    if (reviewSkips.length > 0) {
        logger.warn({
            event: 'orchestrator_tool_skips_review',
            phase,
            documentId: document?.id || document?.filename,
            skipped: reviewSkips,
            reviewReasonCount: reviewSkips.length,
            reviewReasons: reviewSkips.map(skip => skip.reason)
        });
    }

    if (summary.phase === ORCHESTRATOR_TOOL_PHASES.PRE_VISION) {
        summary.normalization = buildNormalizationMetadata(summary);
    }

    return summary;
}

module.exports = {
    REVIEW_SKIP_REASONS,
    requiresHumanReview,
    buildNormalizationMetadata,
    attachToolingSummary,
    executeToolCalls
};
