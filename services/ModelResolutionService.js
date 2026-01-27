const axios = require('axios');
const config = require('../config/config');

class ModelResolutionService {
  constructor(options = {}) {
    this._ollamaCache = null;
    this._ollamaCacheExpiresAt = 0;
    this._ollamaTtl = options.ollamaTtlMs || 5 * 60 * 1000; // 5 minutes
    this._fetchOllamaModels = options.fetchOllamaModels || this._defaultFetchOllamaModels.bind(this);
  }

  async _defaultFetchOllamaModels() {
    // Best-effort: try HTTP /models endpoint, otherwise fall back to configured models
    const url = config.ollama && config.ollama.apiUrl ? `${config.ollama.apiUrl.replace(/\/$/, '')}/models` : null;
    if (url) {
      try {
        const res = await axios.get(url, { timeout: 2000 });
        if (res && res.data && Array.isArray(res.data.models)) {
          return res.data.models.map(m => (typeof m === 'string' ? m : m.name));
        }
      } catch (e) {
        // ignore and fallback
      }
    }

    // Fallback to configured keys
    const models = new Set();
    if (config.ollama && config.ollama.model) models.add(config.ollama.model);
    if (config.ollama && config.ollama.visionModel) models.add(config.ollama.visionModel);
    if (config.ollama && config.ollama.plannerModel) models.add(config.ollama.plannerModel);
    if (config.ollama && config.ollama.routerModel) models.add(config.ollama.routerModel);

    return Array.from(models).filter(Boolean);
  }

  async getModelsForProvider(provider) {
    const p = (provider || '').toLowerCase();
    if (p === 'ollama') {
      const now = Date.now();
      if (this._ollamaCache && now < this._ollamaCacheExpiresAt) {
        return this._ollamaCache;
      }
      const models = await this._fetchOllamaModels();
      this._ollamaCache = Array.isArray(models) ? models : [];
      this._ollamaCacheExpiresAt = Date.now() + this._ollamaTtl;
      return this._ollamaCache;
    }

    if (p === 'openai') {
      const m = process.env.PAPERLESS_OPENAI_MODEL || process.env.OPENAI_MODEL;
      return m ? [m] : [];
    }

    if (p === 'azure') {
      const m = config.azure && config.azure.deploymentName ? config.azure.deploymentName : process.env.AZURE_DEPLOYMENT_NAME;
      return m ? [m] : [];
    }

    if (p === 'custom') {
      const m = config.custom && config.custom.model ? config.custom.model : process.env.CUSTOM_MODEL;
      return m ? [m] : [];
    }

    return [];
  }

  async getAllModels() {
    const providers = ['ollama', 'openai', 'azure', 'custom'];
    const result = {};
    for (const p of providers) {
      result[p] = await this.getModelsForProvider(p);
    }
    return result;
  }

  async validateModel(provider, modelId) {
    const list = await this.getModelsForProvider(provider);
    if (!list || !modelId) return false;
    return list.includes(modelId);
  }

  getExpertModels() {
    return config.expertModels || {};
  }
}

module.exports = new ModelResolutionService();
module.exports.ModelResolutionService = ModelResolutionService; // export class for testing/injection
