const { calculateTokens } = require('./utils');
const logger = require('../logger');

module.exports = {
    async analyzePlayground(content, prompt) {
        try {
            // Calculate context window size
            const promptTokenCount = calculateTokens(prompt);
            const numCtx = this._calculateNumCtx(promptTokenCount, 512);

            // Generate playground system prompt (simpler than full analysis)
            const systemPrompt = this.promptFactory.buildBaseTemplate('playground');

            // Call Ollama API
            const response = await this._callOllamaAPI(
                prompt + "\n\n" + JSON.stringify(content),
                systemPrompt,
                numCtx,
                this.playgroundSchema
            );

            // Process response
            const parsedResponse = this._processOllamaResponse(response);

            // Check for missing data
            if (parsedResponse.tags.length === 0 && parsedResponse.correspondent === null) {
                logger.warn('No tags or correspondent found in response from Ollama. Review your prompt or switch to OpenAI.');
            }

            // Return results in consistent format
            return {
                document: parsedResponse,
                metrics: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0
                },
                truncated: false
            };
        } catch (error) {
            logger.error('Error analyzing document with Ollama:', error);
            return {
                document: this._emptyDocument(),
                metrics: null,
                error: error.message
            };
        }
    },

    async generateText(prompt) {
        try {
            // Calculate context window size based on prompt length
            const promptTokenCount = calculateTokens(prompt);
            const numCtx = this._calculateNumCtx(promptTokenCount, 1024);

            // Simple system prompt for text generation
            const systemPrompt = this.promptFactory.buildGenericAssistantPrompt();

            // Call Ollama API without enforcing a specific response format
            const response = await this.client.post(`${this.apiUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                system: systemPrompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    num_predict: 1024,
                    num_ctx: numCtx
                }
            });

            if (!response.data || !response.data.response) {
                throw new Error('Invalid response from Ollama API');
            }

            return response.data.response;
        } catch (error) {
            logger.error('Error generating text with Ollama:', error);
            throw error;
        }
    }
};
