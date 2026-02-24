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
const config = require('../../config/config');
const fs = require('fs').promises;
const path = require('path');
const { authenticateApi, requireAdmin } = require('../../middleware/auth');
const AIServiceFactory = require('../../services/aiServiceFactory');
const { stripThinkingTags } = require('../../services/ollama/utils');

let guidanceClient = null;

/** Helper to strip base64 header */
function stripBase64Header(base64Str) {
  if (!base64Str) return '';
  const match = base64Str.match(/^data:image\/[a-z]+;base64,(.+)$/i);
  return match ? match[1] : base64Str;
}

function parseImagePathCandidates(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string');
  }
  if (typeof value !== 'string') {
    return [];
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string');
      }
    } catch (_err) {
      // Treat malformed JSON path list as a single path token below.
    }
  }
  return [trimmed];
}

function resolveAbsoluteImagePath(candidatePath) {
  if (typeof candidatePath !== 'string' || candidatePath.trim() === '') {
    return null;
  }
  return path.isAbsolute(candidatePath)
    ? candidatePath
    : path.resolve(process.cwd(), candidatePath);
}

async function resolveVisionImagePayload(variables = {}) {
  const pathCandidates = [
    ...parseImagePathCandidates(variables.__image_paths),
    ...parseImagePathCandidates(variables.image_paths),
    ...parseImagePathCandidates(variables.__image_path),
    ...parseImagePathCandidates(variables.image_path)
  ];

  if (pathCandidates.length > 0) {
    const images = [];
    const resolvedPaths = [];
    for (const candidatePath of pathCandidates) {
      const absolutePath = resolveAbsoluteImagePath(candidatePath);
      if (!absolutePath) {
        continue;
      }
      let imageBuffer = null;
      try {
        imageBuffer = await fs.readFile(absolutePath);
      } catch (readError) {
        const error = new Error(
          `Unable to read PNG attachment for multimodal test: ${candidatePath}`
        );
        error.code = 'VISUAL_ATTACHMENT_FAILED';
        error.context = { candidatePath, absolutePath };
        throw error;
      }
      if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
        const error = new Error(
          `PNG attachment is empty for multimodal test: ${candidatePath}`
        );
        error.code = 'VISUAL_ATTACHMENT_FAILED';
        error.context = { candidatePath, absolutePath };
        throw error;
      }
      images.push(imageBuffer.toString('base64'));
      resolvedPaths.push(absolutePath);
    }

    if (images.length === 0) {
      const error = new Error(
        'No readable PNG attachments were provided for multimodal test execution'
      );
      error.code = 'VISUAL_INPUT_MISSING';
      throw error;
    }

    return {
      images,
      source: 'png_path',
      paths: resolvedPaths
    };
  }

  const rawImageData = variables.__image_data
    || variables.image_data
    || variables.document_image_b64
    || null;
  if (rawImageData) {
    const imageList = Array.isArray(rawImageData)
      ? rawImageData
      : [rawImageData];
    const images = imageList
      .map((img) => stripBase64Header(img))
      .filter(Boolean);
    if (images.length > 0) {
      return {
        images,
        source: 'inline_base64',
        paths: []
      };
    }
  }

  return {
    images: [],
    source: 'none',
    paths: []
  };
}

/** Robust JSON extraction from LLM responses */
function extractJSON(text) {
  if (typeof text !== 'string') return text;
  if (!text.trim()) return null;

  // 1) Robust removal of thinking/reasoning tags (including unclosed ones)
  const cleanedText = stripThinkingTags(text);
  if (!cleanedText) return null;

  // 2) Try direct parse
  try {
    return JSON.parse(cleanedText);
  } catch (e) { /* fallthrough */ }

  // 3) Try Markdown code fence extraction (```json ... ``` or ``` ... ```)
  const fenceMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (e) {
      // If direct parse of fence fails, try to extract from within the fence
      const innerBraceMatch = fenceMatch[1].match(/\{[\s\S]*\}/);
      if (innerBraceMatch) {
        try { return JSON.parse(innerBraceMatch[0]); } catch (e2) { /* fallthrough */ }
      }
    }
  }

  // 4) Try braced JSON extraction (greedy match for the largest possible object)
  const braceMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    let candidate = braceMatch[0];
    try {
      return JSON.parse(candidate);
    } catch (err) {
      // Attempt heuristic repairs for common LLM mistakes
      try {
        // Fix double-escaped quotes
        candidate = candidate.replace(/\\"/g, '"');
        // Fix unquoted keys
        candidate = candidate.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
        // Replace single quotes with double quotes
        candidate = candidate.replace(/'([^']+)':/g, '"$1":')
                           .replace(/:\s*'([^']*)'/g, ': "$1"')
                           .replace(/\[\s*'([^']*)'/g, '["$1"')
                           .replace(/'([^']*)'\s*\]/g, '"$1"]')
                           .replace(/,\s*'([^']*)'/g, ', "$1"')
                           .replace(/'([^']*)'\s*,/g, '"$1",');
        // Fix trailing commas
        candidate = candidate.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');
          
        return JSON.parse(candidate);
      } catch (err2) {
        return null;
      }
    }
  }
  
  return null;
}

function isPlainTextPrompt(promptId) {
  const normalized = String(promptId || '').trim().toUpperCase();
  if (!normalized) return false;
  return normalized === 'VIS_OCR_V1' || normalized.startsWith('VIS_OCR_');
}

function shouldValidateJsonOutput(promptId, mode) {
  if (mode !== 'execute') {
    return true;
  }
  return !isPlainTextPrompt(promptId);
}

/** Extract response text from Ollama vision result or chunk */
function extractVisionResponseText(visionResult, ollamaService = null) {
  if (typeof visionResult === 'string' && visionResult) {
    return visionResult;
  }

  // Favor explicit response fields
  if (typeof visionResult?.response === 'string' && visionResult.response) {
    return visionResult.response;
  }
  if (
    typeof visionResult?.message?.content === 'string'
    && visionResult.message.content
  ) {
    return visionResult.message.content;
  }

  // Fallback to service helper if available
  if (
    ollamaService
    && typeof ollamaService._extractRawOllamaText === 'function'
  ) {
    const extracted = ollamaService._extractRawOllamaText(visionResult);
    if (typeof extracted === 'string' && extracted.length > 0) {
      return extracted;
    }
  }

  // Last resort: thinking field (usually handled separately in stream)
  if (typeof visionResult?.thinking === 'string' && visionResult.thinking) {
    return visionResult.thinking;
  }

  return '';
}

/** Get or create GuidanceClient singleton (lazy init) */
/**
 * Stateful stream sanitizer to detect and route thinking tags even if split across chunks.
 * Also supports optional start/end markers to trim conversational preamble.
 */
class StreamSanitizer {
  constructor(onToken, onThinking, options = {}) {
    this.onToken = onToken;
    this.onThinking = onThinking;
    this.isInsideThinking = false;
    this.currentEndTag = null;
    this.buffer = '';
    this.tags = [
      { start: '<think>', end: '</think>' },
      { start: '<thinking>', end: '</thinking>' },
      { start: '<reasoning>', end: '</reasoning>' }
    ];
    
    // Preamble trimming support
    this.startMarker = options.startMarker || null;
    this.endMarker = options.endMarker || null;
    this.hasSeenStartMarker = options.prefilledStartMarker || !this.startMarker;
    this.hasSeenEndMarker = false;
    
    // Monologue detection
    this.isCheckingForPreamble = true;
    this.monologuePrefixes = [
      "Got it", "Sure", "Here is", "I will", "Okay", "Analyzing", "Let's", 
      "The document", "Starting with", "I'll", "I've", "Certainly", "Understood",
      "Extracting", "Here are", "The image shows"
    ];
  }

  push(text) {
    if (!text || this.hasSeenEndMarker) return;
    this.buffer += text;
    this._processBuffer();
  }

  _processBuffer() {
    let changed = true;
    while (changed) {
      changed = false;
      
      // 1) Handle start marker (preamble) - Skip if prefilled or already seen
      if (!this.hasSeenStartMarker) {
        const markerIdx = this.buffer.indexOf(this.startMarker);
        if (markerIdx !== -1) {
          const preamble = this.buffer.substring(0, markerIdx);
          if (preamble) this.onThinking(preamble);
          this.buffer = this.buffer.substring(markerIdx + this.startMarker.length);
          this.hasSeenStartMarker = true;
          this.isCheckingForPreamble = false; 
          changed = true;
          continue;
        } else {
          // Look for partial start marker
          let maxPartialLen = 0;
          for (let len = Math.min(this.startMarker.length - 1, this.buffer.length); len > 0; len--) {
            const partial = this.buffer.substring(this.buffer.length - len);
            if (this.startMarker.startsWith(partial)) {
              maxPartialLen = len;
              break;
            }
          }
          const safe = this.buffer.substring(0, this.buffer.length - maxPartialLen);
          if (safe) this.onThinking(safe);
          this.buffer = this.buffer.substring(this.buffer.length - maxPartialLen);
          return;
        }
      }

      // 2) Handle end marker
      if (this.endMarker && !this.hasSeenEndMarker) {
        const endIdx = this.buffer.indexOf(this.endMarker);
        if (endIdx !== -1) {
          const content = this.buffer.substring(0, endIdx);
          this._processContent(content);
          this.buffer = this.buffer.substring(endIdx + this.endMarker.length);
          this.hasSeenEndMarker = true;
          if (this.buffer) this.onThinking(this.buffer);
          this.buffer = '';
          return;
        }
      }

      // 3) Detect thinking tags
      if (!this.isInsideThinking) {
        let earliestStart = -1;
        let matchedTag = null;
        for (const tag of this.tags) {
          const pos = this.buffer.indexOf(tag.start);
          if (pos !== -1 && (earliestStart === -1 || pos < earliestStart)) {
            earliestStart = pos;
            matchedTag = tag;
          }
        }

        if (earliestStart !== -1) {
          const before = this.buffer.substring(0, earliestStart);
          if (before) this._handleContent(before);
          this.isInsideThinking = true;
          this.currentEndTag = matchedTag.end;
          this.buffer = this.buffer.substring(earliestStart + matchedTag.start.length);
          changed = true;
          continue;
        }
      } else {
        const endPos = this.buffer.indexOf(this.currentEndTag);
        if (endPos !== -1) {
          const thought = this.buffer.substring(0, endPos);
          if (thought) this.onThinking(thought);
          this.isInsideThinking = false;
          this.buffer = this.buffer.substring(endPos + this.currentEndTag.length);
          this.currentEndTag = null;
          changed = true;
          continue;
        }
      }

      // 4) Detect preamble monologue (if no markers/tags found yet)
      if (this.isCheckingForPreamble && !this.isInsideThinking) {
        const newlineIdx = this.buffer.indexOf('\n');
        if (newlineIdx !== -1) {
          const firstLine = this.buffer.substring(0, newlineIdx).trim();
          if (this.monologuePrefixes.some(p => firstLine.startsWith(p))) {
            this.onThinking(this.buffer.substring(0, newlineIdx + 1));
            this.buffer = this.buffer.substring(newlineIdx + 1);
            changed = true;
            continue;
          }
          this.isCheckingForPreamble = false;
        } else if (this.buffer.length > 60) {
          if (this.monologuePrefixes.some(p => this.buffer.trim().startsWith(p))) {
            return; // Wait for newline to capture full monologue
          }
          this.isCheckingForPreamble = false;
        } else if (this.buffer.length > 0) {
          // If it doesn't match any monologue prefix even partially, don't block
          const current = this.buffer.trim();
          const matchesAny = this.monologuePrefixes.some(p => 
            p.toLowerCase().startsWith(current.toLowerCase()) || 
            current.toLowerCase().startsWith(p.toLowerCase())
          );
          if (!matchesAny) {
            this.isCheckingForPreamble = false;
          } else {
            return; // Potential monologue, wait for more
          }
        }
      }

      // 5) Buffer partials
      let maxPartialLen = 0;
      const candidates = [...this.tags.map(t => this.isInsideThinking ? t.end : t.start)];
      if (this.endMarker && !this.isInsideThinking) candidates.push(this.endMarker);
      if (this.startMarker && !this.hasSeenStartMarker) candidates.push(this.startMarker);

      for (const cand of candidates) {
        if (!cand) continue;
        for (let len = Math.min(cand.length - 1, this.buffer.length); len > 0; len--) {
          const partial = this.buffer.substring(this.buffer.length - len);
          if (cand.startsWith(partial)) {
            maxPartialLen = Math.max(maxPartialLen, len);
            break;
          }
        }
      }

      if (maxPartialLen > 0) {
        const safe = this.buffer.substring(0, this.buffer.length - maxPartialLen);
        if (safe) {
          if (this.isInsideThinking) this.onThinking(safe);
          else this._handleContent(safe);
        }
        this.buffer = this.buffer.substring(this.buffer.length - maxPartialLen);
        return; 
      } else {
        if (this.buffer) {
          if (this.isInsideThinking) this.onThinking(this.buffer);
          else this._handleContent(this.buffer);
          this.buffer = '';
        }
        break;
      }
    }
  }

  _handleContent(text) {
    if (this.isCheckingForPreamble) {
       // Preamble check was skipped because of tags or too long text
       this.isCheckingForPreamble = false;
    }
    this.onToken(text);
  }

  _processContent(text) {
    let current = text;
    while (current) {
      // Logic from _processBuffer simplified for atomic block
      this.onToken(current); // Simplification: in content block, we assume no tags for now
      current = '';
    }
  }

  flush() {
    if (this.buffer) {
      if (this.isInsideThinking) this.onThinking(this.buffer);
      else this.onToken(this.buffer);
      this.buffer = '';
    }
  }
}

function getGuidanceClient() {
  if (!guidanceClient) {
    try {
      const { GuidanceClient } = require('../../services/guidance/GuidanceClient');
      const guidanceUrl = process.env.GUIDANCE_SERVICE_URL || config.guidanceService?.url || 'http://guidance_service:8002';
      guidanceClient = new GuidanceClient({ baseUrl: guidanceUrl });
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

    const isMultimodal = prompt.modelType === 'multimodal';
    let visionPayload = { images: [], source: 'none', paths: [] };
    try {
      visionPayload = await resolveVisionImagePayload(variables);
    } catch (imageError) {
      if (
        imageError?.code === 'VISUAL_ATTACHMENT_FAILED'
        || imageError?.code === 'VISUAL_INPUT_MISSING'
      ) {
        return res.status(422).json({
          success: false,
          error: imageError.message,
          code: imageError.code,
          context: imageError.context || null
        });
      }
      throw imageError;
    }

    logger.info({
      event: 'prompt_test_execution_start',
      promptId: id,
      mode,
      variablesCount: Object.keys(variables).length,
      hasImage: visionPayload.images.length > 0,
      imageSource: visionPayload.source
    });

    if (isMultimodal && mode === 'execute' && visionPayload.images.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'Multimodal prompt execution requires PNG attachment paths (__image_path or __image_paths).',
        code: 'VISUAL_INPUT_MISSING'
      });
    }

    const startTime = Date.now();
    let testResult = null;
    let source = 'template-render';
    let tokenEstimate = null;
    let guidanceMetadata = null;
    const shouldValidateJson = shouldValidateJsonOutput(id, mode);

    // MULTIMODAL VISION PATH: Call Ollama vision API directly
    if (isMultimodal && visionPayload.images.length > 0 && mode === 'execute') {
      try {
        const ollamaService = AIServiceFactory.getService();
        if (ollamaService && (typeof ollamaService._callOllamaVisionAPI === 'function' || typeof ollamaService.generate === 'function')) {
          const visionImages = visionPayload.images;
          const combinedPrompt = renderedSystemPrompt + '\n\n' + renderedTemplate;
          const domainKey = prompt.domain?.toLowerCase() || 'general';
          // Reconcile Source of Truth: Pull from config.expertModels, fallback to global vision limits
          const _maxTokens = prompt.config?.maxTokens ||
                           config.expertModels?.[domainKey]?.vision?.limits?.maxResponseTokens ||
                           config.ollama?.limits?.vision?.maxResponseTokens || 8192;

          let visionResult;
          if (typeof ollamaService._callOllamaVisionAPI === 'function') {
            visionResult = await ollamaService._callOllamaVisionAPI(
              combinedPrompt,
              visionImages,
              {
                model: prompt.model,
                temperature: 0.0,
                kind: 'vision',
                num_predict: 8192, // Hardened prediction budget (P0)
                num_ctx: 32768,    // Hardened context baseline (P0)
              }
            );
          } else {
            visionResult = await ollamaService.generate({
              model: prompt.model,
              prompt: combinedPrompt,
              images: visionImages,
              options: { 
                temperature: 0.0, 
                num_predict: 8192, // Hardened prediction budget (P0)
                num_ctx: 32768    // Hardened context baseline (P0)
              }
            });
          }

          let visionText = extractVisionResponseText(visionResult, ollamaService);
          if (!visionText || !visionText.trim()) {
            // Single retry for transient empty outputs from local vision models.
            if (typeof ollamaService._callOllamaVisionAPI === 'function') {
              const retryResult = await ollamaService._callOllamaVisionAPI(
                combinedPrompt,
                visionImages,
                {
                  model: prompt.model,
                  temperature: 0.0,
                  kind: 'vision',
                  num_predict: 8192,
                  num_ctx: 32768
                }
              );
              visionText = extractVisionResponseText(retryResult, ollamaService);
              if (retryResult?.model && !visionResult?.model) {
                visionResult.model = retryResult.model;
              }
              if (
                typeof retryResult?.eval_count === 'number'
                && !visionResult?.eval_count
              ) {
                visionResult.eval_count = retryResult.eval_count;
              }
              if (
                typeof retryResult?._truncated === 'boolean'
                && visionResult?._truncated !== true
              ) {
                visionResult._truncated = retryResult._truncated;
              }
            }
          }
          if (!visionText || !visionText.trim()) {
            throw new Error('Vision model returned empty output');
          }

          testResult = visionText;
          source = 'ollama-vision';
          guidanceMetadata = {
            model: visionResult?.model || prompt.model,
            eval_count: visionResult?.eval_count,
            truncated: visionResult?._truncated || false,
          };
        } else {
          logger.warn('[Prompts API] Ollama vision/generate not available for multimodal test');
          return res.status(502).json({
            success: false,
            error: 'Ollama vision/generate service unavailable',
            code: 'VISION_EXECUTION_FAILED'
          });
        }
      } catch (err) {
        logger.warn('[Prompts API] Vision test call failed:', err.message);
        return res.status(502).json({
          success: false,
          error: `Vision test call failed: ${err.message}`,
          code: 'VISION_EXECUTION_FAILED'
        });
      }
    }

    // TEXT PATH: Use guidance service for validation or text-only execution
    if (source === 'template-render') {
      const client = getGuidanceClient();
      if (client) {
        try {
          const available = await client.isAvailable();
          if (available) {
            if (mode === 'execute') {
              // EXECUTION MODE: Run the actual prompt
              
              // OPTIMIZATION: If the prompt implies a JSON structure, we can provide a schema 
              // to guidance to force valid JSON output (leveraging token healing).
              let schemaJson = null;
              if (renderedTemplate.toLowerCase().includes('json structure')) {
                 const schemaMatch = renderedTemplate.match(/\{[\s\S]*\}/);
                 if (schemaMatch) {
                   try {
                     // Convert template placeholders to valid JSON types for guidance schema
                     // e.g. <string>, <number>, true|false
                     let templateJson = schemaMatch[0]
                        .replace(/"?<[^>]+>"?/g, '"string"')
                        .replace(/true\|false/g, 'true')
                        .replace(/'/g, '"');
                     
                     schemaJson = JSON.parse(templateJson);
                   } catch (e) {
                     schemaJson = null;
                   }
                 }
              }

              const genResult = await client.generate('raw_prompt', {
                system_prompt: renderedSystemPrompt,
                user_prompt: renderedTemplate,
                document_image_b64: '', // No image in text path
                max_tokens: prompt.config?.maxTokens || 4000,
                schema_json: schemaJson
              }, {
                temperature: 0.0,
                model: prompt.model
              });
              
              // Extract the 'output' variable from guidance result
              testResult = genResult?.generated?.output || genResult?.generated || null;
              source = 'guidance-service-execution';
              guidanceMetadata = genResult?.metadata || null;
            } else {
              // VALIDATION MODE: Existing behavior
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
              source = 'guidance-service-validation';
              guidanceMetadata = genResult?.metadata || null;
            }
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
    if (shouldValidateJson && testResult) {
      const extracted = extractJSON(testResult);
      jsonValid = extracted !== null && typeof extracted === 'object';
    }

    logger.info({
      event: 'prompt_test_execution_complete',
      promptId: id,
      source,
      duration,
      jsonValid,
      resultPreview: typeof testResult === 'string' ? testResult.substring(0, 100) : 'object'
    });

    // Post-generation cleanup for specific prompts like VIS_OCR_V1
    if (id === 'VIS_OCR_V1' && typeof testResult === 'string' && testResult.length > 0) {
      const guidance = getGuidanceClient();
      if (guidance) {
        try {
          const cleaned = await guidance.generate('text_cleaner', { text: testResult });
          if (cleaned.success && cleaned.generated?.output) {
            testResult = cleaned.generated.output;
            logger.info(`[Prompts API] Cleaned VIS_OCR_V1 non-stream response using Guidance text_cleaner`);
          }
        } catch (cleanErr) {
          logger.warn(`[Prompts API] Non-stream text cleaning failed: ${cleanErr.message}`);
        }
      }
    }

    // Final sanitization for the result
    const finalResult = (shouldValidateJson && jsonValid)
      ? extractJSON(testResult)
      : (typeof testResult === 'string' ? stripThinkingTags(testResult) : testResult);

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
      testResult: finalResult,
      jsonValid,
      guidanceMetadata,
    });
  } catch (error) {
    logger.error('[Prompts API] Test failed:', error);
    res.status(500).json({ error: 'Test execution failed' });
  }
});

/**
 * POST /api/prompts/:id/test/stream
 * Streaming version of dry-run test
 */
router.post('/:id/test/stream', express.json(), authenticateApi, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!promptRegistry.has(id)) {
      return res.status(404).json({ error: `Prompt not found: ${id}` });
    }

    const prompt = promptRegistry.get(id);
    const { variables = {}, systemPrompt, userTemplate } = req.body;

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

    const isMultimodal = prompt.modelType === 'multimodal';
    let visionPayload = { images: [], source: 'none', paths: [] };
    try {
      visionPayload = await resolveVisionImagePayload(variables);
    } catch (imageError) {
      if (
        imageError?.code === 'VISUAL_ATTACHMENT_FAILED'
        || imageError?.code === 'VISUAL_INPUT_MISSING'
      ) {
        return res.status(422).json({
          success: false,
          error: imageError.message,
          code: imageError.code,
          context: imageError.context || null
        });
      }
      throw imageError;
    }

    if (isMultimodal && visionPayload.images.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'Multimodal prompt streaming requires PNG attachment paths (__image_path or __image_paths).',
        code: 'VISUAL_INPUT_MISSING'
      });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Initial metadata
    sendEvent('metadata', {
      promptId: id,
      model: prompt.model,
      renderedSystemPrompt,
      renderedTemplate,
      detectedVariables: detectedVars,
      missingVariables: missingVars,
    });

    logger.info({
      event: 'prompt_test_stream_start',
      promptId: id,
      model: prompt.model,
      isMultimodal,
      variablesCount: Object.keys(variables).length,
      hasImage: visionPayload.images.length > 0,
      imageSource: visionPayload.source
    });

    const startTime = Date.now();
    let fullResponse = '';
    let streamError = null;
    const shouldValidateJson = shouldValidateJsonOutput(id, 'execute');

    // STREAMING VISION PATH
    if (isMultimodal && visionPayload.images.length > 0) {
      const ollamaService = AIServiceFactory.getService();
      if (ollamaService && (typeof ollamaService._callOllamaVisionAPI === 'function' || typeof ollamaService.generate === 'function')) {
        const visionImages = visionPayload.images;
        const combinedPrompt = renderedSystemPrompt + '\n\n' + renderedTemplate;
        const domainKey = prompt.domain?.toLowerCase() || 'general';
        // Reconcile Source of Truth: Pull from config.expertModels, fallback to global vision limits
        const _maxTokens2 = prompt.config?.maxTokens ||
                         config.expertModels?.[domainKey]?.vision?.limits?.maxResponseTokens ||
                         config.ollama?.limits?.vision?.maxResponseTokens || 8192;

        try {
          let stream;
          const visionOptions = {
            model: prompt.model,
            temperature: 0.0,
            kind: 'vision',
            num_predict: 8192, // Hardened prediction budget (P0)
            num_ctx: 32768,    // Hardened context baseline (P0)
            stream: true,
          };

          if (typeof ollamaService._callOllamaVisionAPI === 'function') {
            stream = await ollamaService._callOllamaVisionAPI(
              combinedPrompt,
              visionImages,
              visionOptions
            );
          } else {
            stream = await ollamaService.generate({
              model: prompt.model,
              prompt: combinedPrompt,
              images: visionImages,
              options: { 
                temperature: visionOptions.temperature, 
                num_predict: visionOptions.num_predict,
                num_ctx: visionOptions.num_ctx
              },
              stream: true
            });
          }

          if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
            const combinedPromptText = (renderedSystemPrompt + renderedTemplate).trim();
            const sanitizer = new StreamSanitizer(
              (text) => {
                fullResponse += text;
                sendEvent('token', { text });
              },
              (thought) => {
                sendEvent('thinking', { text: thought });
              },
              {
                startMarker: combinedPromptText.endsWith('```text') ? '```text' : (combinedPromptText.includes('[OCR_START]') ? '[OCR_START]' : null),
                prefilledStartMarker: combinedPromptText.endsWith('```text'),
                endMarker: combinedPromptText.includes('```text') ? '```' : (combinedPromptText.includes('[OCR_END]') ? '[OCR_END]' : null)
              }
            );

            for await (const chunk of stream) {
              if (typeof chunk?.error === 'string' && chunk.error) {
                throw new Error(chunk.error);
              }

              // 1) Handle explicit thinking field (DeepSeek/R1 support)
              if (typeof chunk?.thinking === 'string' && chunk.thinking) {
                sendEvent('thinking', { text: chunk.thinking });
                continue;
              }

              const text = extractVisionResponseText(chunk, ollamaService);
              if (text) {
                sanitizer.push(text);
              }
              if (chunk?.done) break;
            }
            sanitizer.flush();
          } else {
            // Fallback for non-streaming response
            const text = extractVisionResponseText(stream, ollamaService);
            if (typeof text === 'string' && text.length > 0) {
              const combinedPromptText = (renderedSystemPrompt + renderedTemplate).trim();
              const sanitizer = new StreamSanitizer(
                (t) => {
                  fullResponse += t;
                  sendEvent('token', { text: t });
                },
                (thought) => {
                  sendEvent('thinking', { text: thought });
                },
                {
                  startMarker: combinedPromptText.endsWith('```text') ? '```text' : (combinedPromptText.includes('[OCR_START]') ? '[OCR_START]' : null),
                  prefilledStartMarker: combinedPromptText.endsWith('```text'),
                  endMarker: combinedPromptText.includes('```text') ? '```' : (combinedPromptText.includes('[OCR_END]') ? '[OCR_END]' : null)
                }
              );
              sanitizer.push(text);
              sanitizer.flush();
            }
          }

          if (!fullResponse || !fullResponse.trim()) {
            // One retry for intermittent empty outputs from local vision models.
            let retryResult;
            if (typeof ollamaService._callOllamaVisionAPI === 'function') {
              retryResult = await ollamaService._callOllamaVisionAPI(
                combinedPrompt,
                visionImages,
                {
                  model: prompt.model,
                  temperature: 0.0,
                  kind: 'vision',
                  num_predict: 8192,
                  num_ctx: 32768
                }
              );
            } else {
              retryResult = await ollamaService.generate({
                model: prompt.model,
                prompt: combinedPrompt,
                images: visionImages,
                options: {
                  temperature: 0.0,
                  num_predict: 8192,
                  num_ctx: 32768
                }
              });
            }
            const retryText = extractVisionResponseText(
              retryResult,
              ollamaService
            );
            if (!retryText || !retryText.trim()) {
              throw new Error('Vision model returned empty output');
            }
            fullResponse = retryText;
            sendEvent('token', { text: retryText });
          }
        } catch (err) {
          logger.warn(
            '[Prompts API] Vision stream primary path failed, attempting fallback:',
            err.message
          );
          try {
            let fallbackResult;
            if (typeof ollamaService._callOllamaVisionAPI === 'function') {
              fallbackResult = await ollamaService._callOllamaVisionAPI(
                combinedPrompt,
                visionImages,
                {
                  model: prompt.model,
                  temperature: 0.0,
                  kind: 'vision',
                  num_predict: 8192,
                  num_ctx: 32768
                }
              );
            } else {
              fallbackResult = await ollamaService.generate({
                model: prompt.model,
                prompt: combinedPrompt,
                images: visionImages,
                options: {
                  temperature: 0.0,
                  num_predict: 8192,
                  num_ctx: 32768
                }
              });
            }

            const fallbackText = extractVisionResponseText(
              fallbackResult,
              ollamaService
            );
            if (!fallbackText || !fallbackText.trim()) {
              throw new Error('Vision fallback returned empty output');
            }
            fullResponse = fallbackText;
            sendEvent('token', { text: fallbackText });
          } catch (fallbackErr) {
            logger.error('[Prompts API] Vision stream failed:', err);
            logger.error('[Prompts API] Vision fallback failed:', fallbackErr);
            streamError = `Vision stream failed: ${err.message}. Fallback failed: ${fallbackErr.message}`;
            sendEvent('error', { error: streamError });
          }
        }
      } else {
        streamError = 'Ollama vision service unavailable';
        sendEvent('error', { error: streamError });
      }
    } else {
      // STREAMING TEXT PATH (Guidance)
      const client = getGuidanceClient();
      if (client) {
        try {
          // Injected variables from the test lab context already contain text_chunk, etc.
          // But we must also pass the rendered prompts for the raw_prompt executor
          const streamVars = {
            ...variables, // Contains text_chunk, classification_json, etc.
            system_prompt: renderedSystemPrompt,
            user_prompt: renderedTemplate
          };

          const result = await client.generate('raw_prompt', streamVars, {
            stream: true,
            max_tokens: prompt.config?.maxTokens || 4000,
            model: prompt.model,
            onProgress: (progress) => {
              if (progress.stage === 'thinking') {
                sendEvent('thinking', { text: progress.content });
              } else {
                sendEvent('token', { text: progress.content });
              }
            }
          });
          
          fullResponse = typeof result.generated === 'string' ? result.generated : JSON.stringify(result.generated);
        } catch (err) {
          logger.error('[Prompts API] Guidance stream failed:', err);
          streamError = `Guidance stream failed: ${err.message}`;
          sendEvent('error', { error: streamError });
        }
      } else {
        streamError = 'Guidance service unavailable';
        sendEvent('error', { error: streamError });
      }
    }

    if (streamError) {
      logger.warn({
        event: 'prompt_test_stream_failed',
        promptId: id,
        error: streamError
      });
      res.end();
      return;
    }

    const duration = Date.now() - startTime;
    
    // Post-generation cleanup for specific prompts like VIS_OCR_V1
    // Leveraging Guidance to extract clean text from monologue-heavy responses
    if (id === 'VIS_OCR_V1' && fullResponse.length > 0) {
      const guidance = getGuidanceClient();
      if (guidance) {
        try {
          const cleaned = await guidance.generate('text_cleaner', { text: fullResponse });
          if (cleaned.success && cleaned.generated?.output) {
            fullResponse = cleaned.generated.output;
            logger.info(`[Prompts API] Cleaned VIS_OCR_V1 response using Guidance text_cleaner`);
          }
        } catch (cleanErr) {
          logger.warn(`[Prompts API] Text cleaning failed: ${cleanErr.message}`);
        }
      }
    }

    const extracted = shouldValidateJson ? extractJSON(fullResponse) : null;
    const jsonValid = shouldValidateJson
      ? (extracted !== null && typeof extracted === 'object')
      : null;

    logger.info({
      event: 'prompt_test_stream_complete',
      promptId: id,
      duration,
      jsonValid,
      resultPreview: typeof fullResponse === 'string' ? fullResponse.substring(0, 100) : 'object'
    });

    sendEvent('done', {
      duration,
      // If JSON was successfully extracted, use it as the testResult for a clean final view
      // otherwise fallback to fullResponse (sanitized)
      testResult: jsonValid ? extracted : stripThinkingTags(fullResponse),
      jsonValid,
      tokenEstimate: Math.ceil((renderedSystemPrompt.length + renderedTemplate.length + fullResponse.length) / 4),
    });

    res.end();
  } catch (error) {
    logger.error('[Prompts API] Streaming test failed:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

router._helpers = {
  stripBase64Header,
  parseImagePathCandidates,
  resolveAbsoluteImagePath,
  resolveVisionImagePayload
};

module.exports = router;
