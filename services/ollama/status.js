module.exports = {
    async listModels() {
        try {
            const response = await this.client.get(`${this.apiUrl}/api/tags`);
            const models = Array.isArray(response?.data?.models)
                ? response.data.models.map((model) => model.name || model.model).filter(Boolean)
                : [];
            return models;
        } catch (error) {
            const logger = require('../logger');
            logger.error('Error fetching Ollama models:', error);
            return [];
        }
    },

    async checkStatus() {
        try {
            const response = await this.client.get(`${this.apiUrl}/api/ps`);
            if (response.status === 200) {
                const data = response.data || {};
                const loadedModels = Array.isArray(data.models)
                    ? data.models
                        .map(model => model.name || model.model)
                        .filter(Boolean)
                    : [];
                const modelName = loadedModels.length > 0
                    ? loadedModels.join(', ')
                    : null;
                const logger = require('../logger');
                logger.info('Ollama loaded models:', modelName || 'none');
                return { status: 'ok', model: modelName, loadedModels };
            }
        } catch (error) {
            const logger = require('../logger');
            logger.error('Error checking Ollama service status:', error);
        }
        return { status: 'error' };
    }
};
