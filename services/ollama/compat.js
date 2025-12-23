const { calculateTokens, truncateToTokenLimit, writePromptToFile } = require('./utils');

module.exports = {
    // Legacy compatibility stubs
    _truncateContent(c) { return truncateToTokenLimit(c, 16000); },
    _calculatePromptTokenCount(text) { return calculateTokens(text); },
    async _logPromptAndResponse(prompt, response) {
        await writePromptToFile(prompt + "\n\n" + JSON.stringify(response, null, 2));
    },
    async chat({ model, messages = [], options = {}, stream = false }) {
        try {
            const response = await this.client.post(`${this.apiUrl}/api/chat`, {
                model,
                messages,
                options,
                stream: stream === true
            });
            return response.data;
        } catch (error) {
            if (error?.response?.status !== 404) {
                throw error;
            }

            const prompt = (messages || [])
                .map(message => message?.content || '')
                .filter(Boolean)
                .join('\n\n');

            const images = [];
            for (const message of messages || []) {
                if (Array.isArray(message?.images)) {
                    images.push(...message.images);
                }
            }

            const payload = {
                model,
                prompt,
                stream: stream === true,
                options
            };

            if (images.length > 0) {
                payload.images = images;
            }

            const response = await this.client.post(`${this.apiUrl}/api/generate`, payload);
            return response.data;
        }
    }
};
