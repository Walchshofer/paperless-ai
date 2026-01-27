/**
 * modelResolver.js
 *
 * Model Resolution Utility for the Expert Model Pipeline
 *
 * This module provides utilities for resolving model names through alias mapping
 * and normalization, supporting production, advanced, and infrastructure tier models.
 *
 * Features:
 * - Model alias resolution for backward compatibility
 * - Model tier identification (production/advanced/infrastructure)
 * - Case normalization and validation
 * - Integration with config.modelAliases
 */

const config = require('../../config/config');
const logger = require('../logger');

/**
 * Resolves a model name through alias mapping and normalization
 * @param {string} modelName - The model name to resolve
 * @returns {string|null} - The resolved canonical model name, or null if invalid
 */
function resolveModelName(modelName) {
  if (!modelName) return null;

  const input = modelName.trim();
  const lowerInput = input.toLowerCase();

  // Build a lowercase alias map for case-insensitive lookup
  const aliasLowerMap = {};
  let rawAliases = null;
  if (config.modelAliases) {
    try {
      // Try direct enumeration first (plain objects)
      for (const [alias, target] of Object.entries(config.modelAliases)) {
        aliasLowerMap[alias.toLowerCase()] = target;
      }
    } catch (err) {
      // Some config exports are proxied and do not support enumeration via Object.entries
      logger.warn({ event: 'model_resolver_alias_map_error', error: err?.message || String(err), modelAliases: config.modelAliases });
    }

    // If aliasLowerMap is empty, try reading the original unproxied config if available
    try {
      if (Object.keys(aliasLowerMap).length === 0) {
        if (typeof config.getRaw === 'function') rawAliases = config.getRaw('modelAliases');
        else if (typeof config.__getOriginal === 'function') rawAliases = config.__getOriginal('modelAliases');
        if (rawAliases && typeof rawAliases === 'object') {
          for (const [alias, target] of Object.entries(rawAliases)) {
            aliasLowerMap[alias.toLowerCase()] = target;
          }
        }
      }
    } catch (err) {
      // ignore
    }

    // If enumeration yielded nothing (proxied config), try direct property lookups on proxy
    try {
      const directKeysToTry = [input, lowerInput, input.split(':')[0], input.split(':')[0].toLowerCase()];
      for (const k of directKeysToTry) {
        try {
          const val = config.modelAliases && config.modelAliases[k];
          if (val) {
            logger.debug({ event: 'resolveModel_direct_alias_found', modelName: input, key: k, target: val });
            return val;
          }
        } catch (e) {
          // ignore property access errors on proxy
        }
      }
    } catch (err) {
      // ignore
    }

    // Debug: Emit lightweight diagnostic for failing test scenarios
    try {
      logger.debug({
        event: 'resolveModel_debug_aliases',
        modelName: input,
        lowerInput,
        aliasCount: Object.keys(aliasLowerMap).length,
        sampleAliases: (rawAliases && Object.keys(rawAliases)) || Object.keys(config.modelAliases || {}).slice(0, 20)
      });
    } catch (err) {
      // Swallow logging errors to avoid breaking test runs
    }
  } else {
    logger.debug({ event: 'model_resolver_no_aliases' });
  }

  // 1) Exact alias match (case-insensitive)
  if (aliasLowerMap[lowerInput]) {
    return aliasLowerMap[lowerInput];
  }

  // 2) Direct known model match (case-insensitive)
  const allModels = Object.values(listModelsByTier()).flat();
  const allModelsLower = new Set(allModels.map(m => m.toLowerCase()));
  if (allModelsLower.has(lowerInput)) {
    // Return the canonical model name as defined in the tiers (preserve canonical spelling)
    const original = allModels.find(m => m.toLowerCase() === lowerInput);
    return original || lowerInput;
  }

  // 3) Strip suffix after ':' and retry alias lookup or known-model match
  const base = input.split(':')[0];
  const lowerBase = base.toLowerCase();

  if (aliasLowerMap[lowerBase]) {
    return aliasLowerMap[lowerBase];
  }

  if (allModelsLower.has(lowerBase)) {
    // Return the canonical base model name if present
    const originalBase = allModels.find(m => m.toLowerCase() === lowerBase);
    return originalBase || lowerBase;
  }

  // Fallback: return lowercased input
  return lowerInput;
}

/**
 * Gets model metadata from the registry (placeholder for future implementation)
 * @param {string} modelName - The model name to look up
 * @returns {object|null} - Model metadata or null if not found
 */
function getModelInfo(modelName) {
  const resolved = resolveModelName(modelName);
  if (!resolved) return null;

  // This would integrate with a full model registry
  // For now, return basic info based on known models
  const knownModels = {
    'qwen3-vl:8b': { type: 'multimodal', vram: '10GB', tier: 'production' },
    'llava-med-v1.6': { type: 'multimodal', vram: '9GB', tier: 'production' },
    'medtext-llama3': { type: 'text', vram: '6GB', tier: 'production' },
    'fino1-8b': { type: 'text', vram: '6GB', tier: 'production' },
    'sauerkraut-llama3.1:8b': { type: 'text', vram: '6GB', tier: 'production' },
    'llama3.2:latest': { type: 'text', vram: '6GB', tier: 'legacy' },
    'llm-pro-finance-8b': { type: 'text', vram: '9GB', tier: 'advanced' },
    'gpt-oss': { type: 'text', vram: '13GB', tier: 'advanced' },
    'nemotron-orchestrator:8b': { type: 'text', vram: '8GB', tier: 'advanced' },
    'nomic-embed-text-v1.5': { type: 'embedding', vram: '2GB', tier: 'infrastructure' },
    'tomoro-colqwen3-embed-8b': { type: 'embedding', vram: '12GB+', tier: 'infrastructure' }
  };

  return knownModels[resolved] || null;
}

/**
 * Identifies the tier of a model (production/advanced/infrastructure)
 * @param {string} modelName - The model name to categorize
 * @returns {string} - The model tier ('production', 'advanced', 'infrastructure', or 'unknown')
 */
function getModelTier(modelName) {
  const resolved = resolveModelName(modelName);
  if (!resolved) return 'unknown';

  // Production tier - actively used in pipelines
  const productionModels = [
    'qwen3-vl:8b', 'llava-med-v1.6', 'medtext-llama3',
    'fino1-8b', 'sauerkraut-llama3.1:8b'
  ];

  // Advanced tier - documented but optional
  const advancedModels = [
    'llm-pro-finance-8b', 'gpt-oss', 'nemotron-orchestrator:8b'
  ];

  // Infrastructure tier - embeddings and orchestration
  const infrastructureModels = [
    'nomic-embed-text-v1.5', 'tomoro-colqwen3-embed-8b'
  ];

  if (productionModels.includes(resolved)) return 'production';
  if (advancedModels.includes(resolved)) return 'advanced';
  if (infrastructureModels.includes(resolved)) return 'infrastructure';

  return 'unknown';
}

/**
 * Validates if a model name is supported
 * @param {string} modelName - The model name to validate
 * @returns {boolean} - True if the model is supported
 */
function isModelSupported(modelName) {
  const resolved = resolveModelName(modelName);
  return resolved !== null && getModelTier(resolved) !== 'unknown';
}

/**
 * Gets all available aliases for a canonical model name
 * @param {string} canonicalName - The canonical model name
 * @returns {string[]} - Array of alias names
 */
function getModelAliases(canonicalName) {
  if (!canonicalName) return [];

  const aliases = [];
  // Prefer reading the raw underlying config when available for reliable enumeration
  let raw = null;
  if (typeof config.getRaw === 'function') raw = config.getRaw('modelAliases');
  else if (typeof config.__getOriginal === 'function') raw = config.__getOriginal('modelAliases');

  if (raw && typeof raw === 'object') {
    for (const [alias, target] of Object.entries(raw)) {
      if (target === canonicalName) aliases.push(alias);
    }
    return aliases;
  }

  if (config.modelAliases) {
    for (const [alias, target] of Object.entries(config.modelAliases)) {
      if (target === canonicalName) aliases.push(alias);
    }
  }

  return aliases;
}

/**
 * Lists all models by tier
 * @returns {object} - Object with tier arrays
 */
function listModelsByTier() {
  return {
    production: [
      'qwen3-vl:8b', 'llava-med-v1.6', 'medtext-llama3',
      'fino1-8b', 'sauerkraut-llama3.1:8b'
    ],
    advanced: [
      'llm-pro-finance-8b', 'gpt-oss', 'nemotron-orchestrator:8b'
    ],
    infrastructure: [
      'nomic-embed-text-v1.5', 'tomoro-colqwen3-embed-8b'
    ]
  };
}

module.exports = {
  resolveModelName,
  getModelInfo,
  getModelTier,
  isModelSupported,
  getModelAliases,
  listModelsByTier
};
