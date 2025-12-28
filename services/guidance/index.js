/**
 * Guidance Service Integration Module
 *
 * Exports the GuidanceClient for integration with the Expert Pipeline system.
 */

const {
    GuidanceClient,
    GuidanceError,
    guidanceClient,
    getFallbackPromptId,
    GUIDANCE_CONFIG
} = require('./GuidanceClient');

module.exports = {
    GuidanceClient,
    GuidanceError,
    guidanceClient,
    getFallbackPromptId,
    GUIDANCE_CONFIG
};
