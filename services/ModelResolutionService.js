const axios = require('axios');
const config = require('../config/config');

class ModelResolutionService {
  constructor(options = {}) {
    this._ollamaCache = null;
    this._ollamaCacheExpiresAt = 0;
    this._ollamaTtl = options.ollamaTtlMs || 5 * 60 * 1000; // 5 minutes
    this._fetchOllamaModels = options.fetchOllamaModels || this._defaultFetchOllamaModels.bind(this);
    // Allow injecting a config object for testing or advanced usecases; fall back to the singleton config
    this._config = options.config || config;
  }

  async _defaultFetchOllamaModels() {
    // Best-effort: try HTTP /models endpoint, otherwise fall back to configured models
    const cfg = this._config;
    const url = cfg.ollama && cfg.ollama.apiUrl ? `${cfg.ollama.apiUrl.replace(/\/$/, '')}/models` : null;
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
    if (cfg.ollama && cfg.ollama.model) models.add(cfg.ollama.model);
    if (cfg.ollama && cfg.ollama.visionModel) models.add(cfg.ollama.visionModel);
    if (cfg.ollama && cfg.ollama.plannerModel) models.add(cfg.ollama.plannerModel);
    if (cfg.ollama && cfg.ollama.routerModel) models.add(cfg.ollama.routerModel);

    return Array.from(models).filter(Boolean);
  }

  async getModelsForProvider(provider) {
    const cfg = this._config;
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
      const m = cfg.azure && cfg.azure.deploymentName ? cfg.azure.deploymentName : process.env.AZURE_DEPLOYMENT_NAME;
      return m ? [m] : [];
    }

    if (p === 'custom') {
      const m = cfg.custom && cfg.custom.model ? cfg.custom.model : process.env.CUSTOM_MODEL;
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
    if (!modelId) return false;

    // If we couldn't discover any models for the provider, be permissive so
    // initial setup or unreachable providers don't hard-fail valid submissions.
    // Only reject if the provider list is non-empty and explicitly does not include the model.
    if (!list || (Array.isArray(list) && list.length === 0)) {
      return true;
    }

    try {
      return Array.isArray(list) ? list.includes(modelId) : false;
    } catch (e) {
      // On any unexpected error, be permissive rather than blocking admin setup
      return true;
    }
  }

  // Clear any internal caches (useful after config changes)
  clearCache() {
    this._ollamaCache = null;
    this._ollamaCacheExpiresAt = 0;
  }

  getExpertModels() {
    // Normalize the expert models config (map/object) to a consistent array shape
    // Prefer raw config accessors when available (to support proxied/config-wrappers)
    const cfg = this._config;
    let raw = null;

    try {
      if (typeof cfg.getRaw === 'function') {
        raw = cfg.getRaw('expertModels');
      }
    } catch (e) {
      /* ignore */
    }

    try {
      if ((raw === null || raw === undefined) && typeof cfg.__getOriginal === 'function') {
        raw = cfg.__getOriginal('expertModels');
      }
    } catch (e) {
      /* ignore */
    }

    if (raw === null || raw === undefined) {
      raw = cfg.expertModels || {};
    }

    const out = [];
    if (!raw || typeof raw !== 'object') return out;

    for (const [category, entries] of Object.entries(raw)) {
      if (entries && typeof entries === 'object') {
        for (const [role, model] of Object.entries(entries)) {
          if (model) out.push({ category, role, model });
        }
      }
    }
    return out;
  }
}

module.exports = new ModelResolutionService();
module.exports.ModelResolutionService = ModelResolutionService; // export class for testing/injection
