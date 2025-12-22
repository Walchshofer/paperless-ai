const fs = require('fs').promises;
const path = require('path');

function calculateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    // Llama/Qwen/GPT-OSS tokenizer estimate: ~3.5 chars per token
    return Math.ceil(text.length / 3.5);
}

function truncateToTokenLimit(content, maxTokens) {
    if (!content) return '';
    const maxChars = maxTokens * 3.5;
    if (content.length <= maxChars) return content;

    let truncated = content.substring(0, maxChars);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > maxChars * 0.8) {
        truncated = content.substring(0, lastPeriod + 1);
    }
    return truncated;
}

function validateDocumentContent(content, minChars = 50) {
    if (!content) return { valid: false, reason: 'Content is empty' };
    if (typeof content !== 'string') return { valid: false, reason: 'Content is not a string' };

    const trimmed = content.trim();
    if (trimmed.length < minChars) {
        return { valid: false, reason: `Content too short (${trimmed.length}/${minChars} chars)` };
    }
    return { valid: true, reason: 'Content is valid' };
}

async function writePromptToFile(content) {
    try {
        const logsPath = path.join(process.cwd(), 'logs', 'prompts');
        await fs.mkdir(logsPath, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('Z')[0];
        const filename = `prompt_${timestamp}.log`;
        await fs.writeFile(path.join(logsPath, filename), `[${new Date().toISOString()}]\n\n${content}`, { encoding: 'utf-8' });
    } catch (e) { /* ignore log errors */ }
}

function extractJsonFromResponse(responseText) {
    if (!responseText || typeof responseText !== 'string') return null;
    try { return JSON.parse(responseText); } catch (e) {}
    const match = responseText.match(/\{[\s\S]*\}/);
    if (match) {
        try { return JSON.parse(match[0]); } catch (e) {}
    }
    return null;
}

module.exports = {
    calculateTokens,
    truncateToTokenLimit,
    validateDocumentContent,
    writePromptToFile,
    extractJsonFromResponse
};
