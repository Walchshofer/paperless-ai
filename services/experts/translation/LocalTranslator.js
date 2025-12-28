const config = require('../../../config/config');
const ollamaService = require('../../ollamaService');
const logger = require('../../logger');

class LocalTranslator {
    constructor(options = {}) {
        this.ollamaService = options.ollamaService || ollamaService;
        this.config = options.config || config.translation || {};
    }

    async translate(text, sourceLang, targetLang, options = {}) {
        const rawText = typeof text === 'string' ? text : '';
        const trimmed = rawText.trim();
        const minChars = parseInt(this.config.minChars || 3, 10);

        if (!trimmed || trimmed.length < minChars) {
            return rawText;
        }

        if (!sourceLang || !targetLang || sourceLang === targetLang) {
            return rawText;
        }

        const model = options.model || this.config.model || config.ollama?.model;
        const maxTokens = options.maxTokens || this.config.maxTokens || 512;
        const temperature = options.temperature ?? this.config.temperature ?? 0.1;
        const contextWindow = Number.isFinite(Number(options.contextWindow))
            ? Number(options.contextWindow)
            : this.config.contextWindow;

        const systemPrompt = [
            'You are a translation engine.',
            `Translate the user text from ${sourceLang} to ${targetLang}.`,
            'Return only the translated text.',
            'Do not add quotes or extra commentary.'
        ].join(' ');

        try {
            const response = await this.ollamaService.chat({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: rawText }
                ],
                options: {
                    temperature,
                    num_predict: maxTokens,
                    ...(Number.isFinite(contextWindow) ? { num_ctx: contextWindow } : {})
                },
                stream: false
            });

            const translated = this._extractResponseText(response);
            return translated ? translated.trim() : rawText;
        } catch (error) {
            logger.warn('[LocalTranslator] Translation failed, returning original text.', {
                error: error.message
            });
            return rawText;
        }
    }

    _extractResponseText(response) {
        if (typeof response?.message?.content === 'string') {
            return response.message.content;
        }
        if (typeof response?.response === 'string') {
            return response.response;
        }
        if (typeof response === 'string') {
            return response;
        }
        return null;
    }
}

module.exports = LocalTranslator;
