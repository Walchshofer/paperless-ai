/**
 * Prompts API Routes
 *
 * Provides JSON API endpoints for managing PromptRegistry prompt templates.
 * Admin-only access for viewing, editing, and resetting prompt templates.
 * Overrides persist to data/prompts.json and are loaded at server startup.
 *
 * @see docs/settings/PROMPTS_SETTINGS_DESIGN.md - Full design specification
 */
const express = require('express');
const router = express.Router();
const { promptRegistry } = require('../../services/prompts/PromptRegistry');
const logger = require('../../services/logger');
const fs = require('fs').promises;
const path = require('path');
const { authenticateApi, requireAdmin } = require('../../middleware/auth');

const OVERRIDES_FILE = path.join(__dirname, '../../data/prompts.json');

/** Extract {{variable}} names from text */
function extractTemplateVars(text) {
  const matches = (text || '').match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -2).trim()))];
}

/** Load overrides file */
async function loadOverrides() {
  try {
    const content = await fs.readFile(OVERRIDES_FILE, 'utf8');
    return JSON.parse(content);
  } catch {
    return { overrides: {}, metadata: {} };
  }
}

/** Save overrides file */
async function saveOverrides(data) {
  data.metadata = {
    ...data.metadata,
    lastModified: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(OVERRIDES_FILE), { recursive: true });
  await fs.writeFile(OVERRIDES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/** Format a registry prompt for API response */
function formatPrompt(prompt, isModified = false) {
  const vars = [
    ...extractTemplateVars(prompt.systemPrompt),
    ...extractTemplateVars(prompt.userTemplate || prompt.userPromptTemplate),
  ];
  return {
    id: prompt.id,
    version: prompt.version || '1.0.0',
    domain: prompt.domain,
    model: prompt.model,
    modelType: prompt.modelType,
    category: prompt.category || null,
    systemPrompt: prompt.systemPrompt,
    userTemplate: prompt.userTemplate || prompt.userPromptTemplate || '',
    config: {
      temperature: prompt.config?.temperature ?? 0.2,
      maxTokens: prompt.config?.maxTokens ?? 2048,
      topK: prompt.config?.topK ?? 40,
      topP: prompt.config?.topP ?? 0.9,
    },
    templateVariables: [...new Set(vars)],
    isModified,
  };
}

/**
 * GET /api/prompts
 * List all registered prompts
 */
router.get('/', authenticateApi, requireAdmin, async (req, res) => {
  try {
    const overridesData = await loadOverrides();
    const overrideIds = new Set(Object.keys(overridesData.overrides || {}));

    const prompts = [];
    for (const p of promptRegistry.prompts.values()) {
      prompts.push(formatPrompt(p, overrideIds.has(p.id)));
    }

    // Build domain counts
    const domainCounts = {};
    for (const p of prompts) {
      domainCounts[p.domain] = (domainCounts[p.domain] || 0) + 1;
    }

    res.json({ prompts, domainCounts });
  } catch (error) {
    logger.error('[Prompts API] List failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prompts/:id
 * Get a specific prompt by ID
 */
router.get('/:id', authenticateApi, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!promptRegistry.has(id)) {
      return res.status(404).json({ error: `Prompt not found: ${id}` });
    }

    const overridesData = await loadOverrides();
    const isModified = Boolean(overridesData.overrides?.[id]);

    const prompt = promptRegistry.get(id);
    res.json(formatPrompt(prompt, isModified));
  } catch (error) {
    logger.error('[Prompts API] Get failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/prompts/:id
 * Update a prompt (systemPrompt, userTemplate, config fields only)
 */
router.put('/:id', express.json(), authenticateApi, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!promptRegistry.has(id)) {
      return res.status(404).json({ error: `Prompt not found: ${id}` });
    }

    const current = promptRegistry.get(id);
    const { systemPrompt, userTemplate, config } = req.body;

    // Validate required fields
    if (systemPrompt !== undefined && typeof systemPrompt !== 'string') {
      return res.status(400).json({ error: 'systemPrompt must be a string' });
    }
    if (userTemplate !== undefined && typeof userTemplate !== 'string') {
      return res.status(400).json({ error: 'userTemplate must be a string' });
    }

    // Validate config values if provided
    if (config && typeof config === 'object') {
      if (config.temperature !== undefined) {
        const temp = Number(config.temperature);
        if (isNaN(temp) || temp < 0 || temp > 2) {
          return res.status(400).json({ error: 'temperature must be between 0.0 and 2.0' });
        }
      }
      if (config.maxTokens !== undefined) {
        const tokens = Number(config.maxTokens);
        if (isNaN(tokens) || tokens <= 0 || !Number.isInteger(tokens)) {
          return res.status(400).json({ error: 'maxTokens must be a positive integer' });
        }
      }
      if (config.topK !== undefined) {
        const topK = Number(config.topK);
        if (isNaN(topK) || topK < 1 || !Number.isInteger(topK)) {
          return res.status(400).json({ error: 'topK must be a positive integer' });
        }
      }
      if (config.topP !== undefined) {
        const topP = Number(config.topP);
        if (isNaN(topP) || topP < 0 || topP > 1) {
          return res.status(400).json({ error: 'topP must be between 0.0 and 1.0' });
        }
      }
    }

    // Build updated prompt
    const updated = {
      ...current,
      systemPrompt: systemPrompt !== undefined ? systemPrompt : current.systemPrompt,
      userTemplate: userTemplate !== undefined ? userTemplate : (current.userTemplate || current.userPromptTemplate),
      config: {
        ...current.config,
        ...(config && typeof config === 'object' ? {
          temperature: config.temperature !== undefined ? Number(config.temperature) : current.config.temperature,
          maxTokens: config.maxTokens !== undefined ? Number(config.maxTokens) : current.config.maxTokens,
          topK: config.topK !== undefined ? Number(config.topK) : current.config.topK,
          topP: config.topP !== undefined ? Number(config.topP) : current.config.topP,
        } : {}),
      },
    };

    // Register with overwrite
    promptRegistry.register(updated, { overwrite: true });

    // Persist override
    const overridesData = await loadOverrides();
    overridesData.overrides[id] = {
      systemPrompt: updated.systemPrompt,
      userTemplate: updated.userTemplate,
      config: updated.config,
    };
    await saveOverrides(overridesData);

    logger.info(`[Prompts API] Updated prompt: ${id}`);

    const result = promptRegistry.get(id);
    res.json({ success: true, prompt: formatPrompt(result, true) });
  } catch (error) {
    logger.error('[Prompts API] Update failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prompts/:id/reset
 * Reset a prompt to its built-in default
 */
router.post('/:id/reset', authenticateApi, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Find the built-in prompt constant from module exports
    const builtinPrompts = require('../../services/prompts/PromptRegistry');
    const builtinPrompt = builtinPrompts[id];

    if (!builtinPrompt || !builtinPrompt.id) {
      return res.status(404).json({ error: `No built-in default found for: ${id}` });
    }

    // Re-register the built-in prompt with overwrite
    promptRegistry.register(builtinPrompt, { overwrite: true });

    // Remove override from persistence
    const overridesData = await loadOverrides();
    delete overridesData.overrides[id];
    await saveOverrides(overridesData);

    logger.info(`[Prompts API] Reset prompt to default: ${id}`);

    const result = promptRegistry.get(id);
    res.json({ success: true, prompt: formatPrompt(result, false) });
  } catch (error) {
    logger.error('[Prompts API] Reset failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
