const { calculateTokens, truncateToTokenLimit, writePromptToFile } = require('./utils');

module.exports = {
    // Legacy compatibility stubs
    _truncateContent(c) { return truncateToTokenLimit(c, 16000); },
    _calculatePromptTokenCount(text) { return calculateTokens(text); },
    async _logPromptAndResponse(prompt, response) {
        await writePromptToFile(prompt + "\n\n" + JSON.stringify(response, null, 2));
    }
};
