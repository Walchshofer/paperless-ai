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
    
    // 1) Handle closed/unclosed thinking tags
    let cleaned = responseText;
    cleaned = cleaned.replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '');
    if (cleaned.includes('<think>') && !cleaned.includes('</think>')) {
        cleaned = cleaned.split('<think>')[0];
    } else if (cleaned.includes('<thinking>') && !cleaned.includes('</thinking>')) {
        cleaned = cleaned.split('<thinking>')[0];
    } else if (cleaned.includes('<reasoning>') && !cleaned.includes('</reasoning>')) {
        cleaned = cleaned.split('<reasoning>')[0];
    }
    cleaned = cleaned.trim();
    if (!cleaned) return null;

    // 2) Try direct parse
    try { return JSON.parse(cleaned); } catch (e) {}

    // 3) Try Markdown code fences
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
        const content = fenceMatch[1].trim();
        try { return JSON.parse(content); } catch (e) {
            const innerBraceMatch = content.match(/\{[\s\S]*\}/);
            if (innerBraceMatch) {
                try { return JSON.parse(innerBraceMatch[0]); } catch (e2) { /* fallthrough */ }
            }
        }
    }

    // 4) Try braced JSON extraction
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
        try { return JSON.parse(match[0]); } catch (e) {}
    }
    return null;
}

function stripThinkingTags(text) {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text;
    // Strip closed tags
    cleaned = cleaned.replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '');
    // Handle unclosed tags (truncation during thinking)
    if (cleaned.includes('<think>') && !cleaned.includes('</think>')) {
        cleaned = cleaned.split('<think>')[0];
    } else if (cleaned.includes('<thinking>') && !cleaned.includes('</thinking>')) {
        cleaned = cleaned.split('<thinking>')[0];
    } else if (cleaned.includes('<reasoning>') && !cleaned.includes('</reasoning>')) {
        cleaned = cleaned.split('<reasoning>')[0];
    }
    return cleaned.trim();
}

module.exports = {
    calculateTokens,
    truncateToTokenLimit,
    validateDocumentContent,
    writePromptToFile,
    extractJsonFromResponse,
    stripThinkingTags
};
