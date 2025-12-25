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

/**
 * Resolves a model name through alias mapping and normalization
 * @param {string} modelName - The model name to resolve
 * @returns {string|null} - The resolved canonical model name, or null if invalid
 */
function resolveModelName(modelName) {
  if (!modelName) return null;

  // Normalize to lowercase for consistent processing
  const normalized = modelName.toLowerCase().trim();

  // Check aliases first (highest priority)
  if (config.modelAliases && config.modelAliases[normalized]) {
    return config.modelAliases[normalized];
  }

  // Return normalized name if no alias found
  return normalized;
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
    'llava-med-v1.5': { type: 'multimodal', vram: '9GB', tier: 'production' },
    'medtext-llama3': { type: 'text', vram: '6GB', tier: 'production' },
    'fino1-8b': { type: 'text', vram: '6GB', tier: 'production' },
    'llm-pro-finance-8b': { type: 'text', vram: '6GB', tier: 'production' },
    'sauerkraut-llama3.1:8b': { type: 'text', vram: '6GB', tier: 'production' },
    'llama3.2:latest': { type: 'text', vram: '6GB', tier: 'legacy' },
    'dragon-finance': { type: 'text', vram: '9GB', tier: 'advanced' },
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
    'qwen3-vl:8b', 'llava-med-v1.5', 'medtext-llama3',
    'fino1-8b', 'llm-pro-finance-8b', 'sauerkraut-llama3.1:8b'
  ];

  // Advanced tier - documented but optional
  const advancedModels = [
    'dragon-finance', 'gpt-oss', 'nemotron-orchestrator:8b'
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
  if (config.modelAliases) {
    for (const [alias, target] of Object.entries(config.modelAliases)) {
      if (target === canonicalName) {
        aliases.push(alias);
      }
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
      'qwen3-vl:8b', 'llava-med-v1.5', 'medtext-llama3',
      'fino1-8b', 'llm-pro-finance-8b', 'sauerkraut-llama3.1:8b'
    ],
    advanced: [
      'dragon-finance', 'gpt-oss', 'nemotron-orchestrator:8b'
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