class JsonRepairService {
    constructor(ollamaService) {
        this.ollamaService = ollamaService;
    }

    // Strictly remove <think>, <thinking>, <reasoning> tags and replace large arrays
    sanitizeForRepair(text) {
        if (!text || typeof text !== 'string') return '';
        let cleaned = text;

        // Remove Dragon/Claude/other reasoning tags and their contents
        cleaned = cleaned.replace(/<\s*(think|thinking|reasoning)[^>]*>[\s\S]*?<\/\s*(think|thinking|reasoning)\s*>/gi, '');

        // Replace JSON-like large arrays on known keys
        cleaned = cleaned.replace(/"(context|embedding|embeddings)"\s*:\s*\[[\s\S]*?\]/gi, '"$1":"[OMITTED_ARRAY]"');

        // Heuristic: replace very long arrays anywhere with a placeholder to avoid parser OOMs
        cleaned = cleaned.replace(/\[[\s\S]{200,}\]/g, '[OMITTED_ARRAY]');

        // Also collapse obviously large numeric arrays
        cleaned = cleaned.replace(/\[(?:\s*-?\d+(?:\.\d+)?\s*,){50,}\s*-?\d+(?:\.\d+)?\s*\]/g, '[OMITTED_NUMERIC_ARRAY]');

        // Trim to a reasonable maximum length
        if (cleaned.length > 12000) {
            cleaned = `${cleaned.substring(0, 12000)}... [truncated ${cleaned.length} chars]`;
        }

        return cleaned.trim();
    }

    // Call the sauerkraut model to repair broken JSON
    async repair(brokenJson) {
        if (!this.ollamaService || typeof this.ollamaService.chat !== 'function') {
            throw new Error('Ollama service is not available');
        }

        const systemMsg = {
            role: 'system',
            content: 'You are a JSON repair assistant. Output ONLY valid raw JSON. Do NOT include any Markdown code fences (```json or ```) or additional commentary.'
        };

        const userMsg = {
            role: 'user',
            content: `Please repair the following JSON so that it is valid. Preserve keys and values where possible. If fields are ambiguous, make sensible corrections. Return raw JSON only (no markdown code fences):\n\n${brokenJson}`
        };

        const response = await this.ollamaService.chat({
            model: 'sauerkraut',
            messages: [systemMsg, userMsg],
            options: { keep_alive: '1m' }
        });

        const content = (typeof response === 'string') ? response : (response.message?.content || response.response || '');
        // Strip code fences if the model still includes them
        const cleaned = content.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

        // Try to parse JSON; if it fails, return raw cleaned string so caller can decide
        try {
            return JSON.parse(cleaned);
        } catch (err) {
            return cleaned;
        }
    }

    // Try regex extraction first; fall back to repair() when parsing fails
    async extractWithRepair(text) {
        if (!text || typeof text !== 'string') return null;

        // 1) Code fence extraction
        const fenceMatch = text.match(/```json[\s\S]*?```/i) || text.match(/```[\s\S]*?```/i);
        if (fenceMatch) {
            const block = fenceMatch[0].replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
            try { return JSON.parse(block); } catch (e) {} // fallthrough
        }

        // 2) Braced JSON extraction (first {...} block)
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
            const candidate = braceMatch[0];
            try { return JSON.parse(candidate); } catch (e) {} // fallthrough
        }

        // 3) Attempt to repair using the model
        const sanitized = this.sanitizeForRepair(text);
        const repaired = await this.repair(sanitized);

        // If repair returned an object already, return it; if it's a string, try parse
        if (repaired && typeof repaired === 'object' && !Array.isArray(repaired)) return repaired;
        if (typeof repaired === 'string') {
            try { return JSON.parse(repaired); } catch (e) { return repaired; }
        }

        return null;
    }
}

module.exports = JsonRepairService;
