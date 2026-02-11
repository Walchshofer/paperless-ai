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
const AIServiceFactory = require('../../services/aiServiceFactory');

/** Strip data URI prefix (e.g. "data:image/png;base64,") if present */
function stripBase64Header(data) {
  if (!data || typeof data !== 'string') return data;
  const commaIdx = data.indexOf(',');
  if (commaIdx > 0 && commaIdx < 100 && data.startsWith('data:')) {
    return data.slice(commaIdx + 1);
  }
  return data;
}

let guidanceClient = null;

/** Get or create GuidanceClient singleton (lazy init) */
function getGuidanceClient() {
  if (!guidanceClient) {
    try {
      const { GuidanceClient } = require('../../services/guidance/GuidanceClient');
      guidanceClient = new GuidanceClient();
    } catch (err) {
      logger.warn('[Prompts API] GuidanceClient not available:', err.message);
    }
  }
  return guidanceClient;
}

/**
 * Validate a prompt template via guidance service.
 * Returns { errors, warnings, ... } or null if guidance unavailable.
 */
async function validatePromptTemplate(systemPrompt, userTemplate, promptEntry) {
  const client = getGuidanceClient();
  if (!client) return null;

  try {
    const available = await client.isAvailable();
    if (!available) return null;

    const knownVars = promptEntry.templateVariables || extractTemplateVars(
      (systemPrompt || '') + ' ' + (userTemplate || '')
    );

    const result = await client.generate('prompt_validator', {
      system_prompt: systemPrompt || '',
      user_template: userTemplate || '',
      known_variables: knownVars,
      prompt_id: promptEntry.id,
      domain: promptEntry.domain,
    }, { temperature: 0.1 });

    return result?.generated || null;
  } catch (err) {
    logger.warn('[Prompts API] Prompt validation failed (non-blocking):', err.message);
    return null;
  }
}

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

    // Validate prompt template via guidance service (pre-save)
    const validation = await validatePromptTemplate(
      systemPrompt !== undefined ? systemPrompt : current.systemPrompt,
      userTemplate !== undefined ? userTemplate : (current.userTemplate || current.userPromptTemplate),
      current
    );

    // Block save if validation returns errors
    if (validation && validation.errors && validation.errors.length > 0) {
      return res.status(422).json({
        error: 'Prompt validation failed',
        validation: {
          errors: validation.errors,
          warnings: validation.warnings || [],
          suggestions: validation.suggestions || [],
          quality_score: validation.quality_score,
          syntax_valid: validation.syntax_valid,
          detected_variables: validation.detected_variables || [],
          unrecognized_variables: validation.unrecognized_variables || [],
        },
      });
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
    const response = { success: true, prompt: formatPrompt(result, true) };

    // Include validation warnings in success response (non-blocking)
    if (validation && validation.warnings && validation.warnings.length > 0) {
      response.validation = {
        warnings: validation.warnings,
        suggestions: validation.suggestions || [],
        quality_score: validation.quality_score,
        syntax_valid: validation.syntax_valid,
        detected_variables: validation.detected_variables || [],
        unrecognized_variables: validation.unrecognized_variables || [],
      };
    }

    res.json(response);
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

/**
 * POST /api/prompts/:id/test
 * Dry-run test a prompt with sample variables
 */
router.post('/:id/test', express.json(), authenticateApi, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!promptRegistry.has(id)) {
      return res.status(404).json({ error: `Prompt not found: ${id}` });
    }

    const prompt = promptRegistry.get(id);
    const { variables = {}, systemPrompt, userTemplate, mode = 'validate' } = req.body;

    // Use provided overrides or current prompt values
    const testSystemPrompt = systemPrompt !== undefined ? systemPrompt : prompt.systemPrompt;
    const testUserTemplate = userTemplate !== undefined ? userTemplate : (prompt.userTemplate || prompt.userPromptTemplate || '');

    // Render the user template with provided variables
    let renderedTemplate = testUserTemplate;
    const detectedVars = extractTemplateVars(testSystemPrompt + ' ' + testUserTemplate);
    const missingVars = [];

    for (const varName of detectedVars) {
      const placeholder = `{{${varName}}}`;
      if (variables[varName] !== undefined) {
        renderedTemplate = renderedTemplate.split(placeholder).join(String(variables[varName]));
      } else {
        missingVars.push(varName);
      }
    }

    // Also render system prompt variables
    let renderedSystemPrompt = testSystemPrompt;
    for (const varName of detectedVars) {
      const placeholder = `{{${varName}}}`;
      if (variables[varName] !== undefined) {
        renderedSystemPrompt = renderedSystemPrompt.split(placeholder).join(String(variables[varName]));
      }
    }

    const startTime = Date.now();
    let testResult = null;
    let source = 'template-render';
    let tokenEstimate = null;
    let guidanceMetadata = null;

    // Extract image data from variables (set by frontend for multimodal tests)
    const rawImageData = variables.__image_data || variables.image_data || variables.document_image_b64 || null;
    const isMultimodal = prompt.modelType === 'multimodal';

    // MULTIMODAL VISION PATH: Call Ollama vision API directly
    // The guidance service cannot handle images (raw_prompt_executor drops them via **kwargs)
    // so for multimodal prompts with image data, we bypass guidance and call Ollama directly
    if (isMultimodal && rawImageData && mode === 'execute') {
      try {
        const ollamaService = AIServiceFactory.getService();
        if (ollamaService && typeof ollamaService._callOllamaVisionAPI === 'function') {
          const cleanImage = stripBase64Header(rawImageData);
          const combinedPrompt = renderedSystemPrompt + '\n\n' + renderedTemplate;

          const visionResult = await ollamaService._callOllamaVisionAPI(
            combinedPrompt,
            cleanImage,
            {
              model: prompt.model,
              temperature: 0.0,
              kind: 'vision',
              num_predict: prompt.config?.maxTokens || 1024,
            }
          );

          testResult = visionResult?.response || null;
          source = 'ollama-vision';
          guidanceMetadata = {
            model: visionResult?.model || prompt.model,
            eval_count: visionResult?.eval_count,
            truncated: visionResult?._truncated || false,
          };
        } else {
          logger.warn('[Prompts API] Ollama vision not available for multimodal test');
          source = 'template-render-only';
        }
      } catch (err) {
        logger.warn('[Prompts API] Vision test call failed:', err.message);
        source = 'template-render-only';
      }
    }

    // TEXT PATH: Use guidance service for validation or text-only execution
    if (source === 'template-render') {
      const client = getGuidanceClient();
      if (client) {
        try {
          const available = await client.isAvailable();
          if (available) {
            const genResult = await client.generate('prompt_validator', {
              system_prompt: renderedSystemPrompt,
              user_template: renderedTemplate,
              known_variables: detectedVars,
              prompt_id: id,
              domain: prompt.domain,
            }, {
              temperature: 0.0,
            });

            testResult = genResult?.generated || null;
            source = 'guidance-service';
            guidanceMetadata = genResult?.metadata || null;
          }
        } catch (err) {
          logger.warn('[Prompts API] Test LLM call failed:', err.message);
          source = 'template-render-only';
        }
      }
    }

    const duration = Date.now() - startTime;

    // Estimate token count (rough: ~4 chars per token)
    const totalChars = renderedSystemPrompt.length + renderedTemplate.length;
    tokenEstimate = Math.ceil(totalChars / 4);

    // Check if output looks like valid JSON
    let jsonValid = null;
    if (testResult) {
      try {
        if (typeof testResult === 'string') {
          JSON.parse(testResult);
        }
        jsonValid = true;
      } catch {
        jsonValid = typeof testResult === 'object';
      }
    }

    res.json({
      success: true,
      promptId: id,
      model: prompt.model,
      source,
      duration,
      renderedSystemPrompt,
      renderedTemplate,
      detectedVariables: detectedVars,
      missingVariables: missingVars,
      providedVariables: Object.keys(variables),
      tokenEstimate,
      testResult,
      jsonValid,
      guidanceMetadata,
    });
  } catch (error) {
    logger.error('[Prompts API] Test failed:', error);
    res.status(500).json({ error: 'Test execution failed' });
  }
});

module.exports = router;
