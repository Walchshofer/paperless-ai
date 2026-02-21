/**
 * VisualTriageService.js
 *
 * Document triage service for first-pass visual domain classification.
 * Uses qwen3-vl through Ollama with SYS_ROUTER_V1 prompt semantics.
 */

const config = require('../../config/config');
const logger = require('../logger');
const { stripThinkingTags } = require('../ollama/utils');
const { promptRegistry, MODEL_NAMES } = require('../prompts/PromptRegistry');
const { resolveDocumentImages } = require('./utils');
const { CircuitBreaker, CircuitState } = require('./CircuitBreaker');

const DOMAIN_LABELS = Object.freeze({
  financial: 'Financial',
  medical: 'Medical',
  legal: 'Legal',
  general: 'General'
});

class VisualTriageService {
  constructor(ollamaService, options = {}) {
    this.ollamaService = ollamaService;

    const cfg = config.visualTriage;
    if (!cfg) {
      throw new Error(
        'config.visualTriage is not defined. ' +
        'Ensure VISUAL_TRIAGE_* env vars are set in .env (SOT: docker-compose.env).'
      );
    }

    this.options = {
      enabled: cfg.enabled,
      promptId: 'SYS_ROUTER_V1',
      model: cfg.model,
      maxPages: cfg.maxPages,
      timeout: cfg.timeout,
      maxRetries: cfg.maxRetries,
      failureThreshold: cfg.failureThreshold,
      cooldownPeriod: cfg.cooldownPeriod,
      ...options
    };

    this.circuitBreaker =
      options.circuitBreaker ||
      CircuitBreaker.getInstance('visual-triage', {
        failureThreshold: this.options.failureThreshold,
        cooldownPeriod: this.options.cooldownPeriod,
        timeout: this.options.timeout,
        maxRetries: this.options.maxRetries,
        initialBackoff: 100,
        backoffMultiplier: 2
      });
  }

  /**
   * Classify a document into expert domains from visual pages.
   *
   * @param {number|string} documentId - Document identifier.
   * @param {string[]|Object} pageImages - Base64 image array or document-like.
   * @param {Object} promptContext - Prompt variables for SYS_ROUTER_V1.
   * @returns {Promise<Object>} Classification result compatible with routing.
   */
  async classifyDocument(documentId, pageImages, promptContext = {}) {
    const startMs = Date.now();

    if (this.options.enabled === false || this.options.enabled === 'no') {
      return this._buildFallback('visual_triage_disabled', startMs, {
        documentId
      });
    }

    let images = this._normalizeImages(pageImages).slice(0, this.options.maxPages);
    let waitedMs = 0;

    // If no images, check if we should wait for rendering
    if (images.length === 0 && promptContext.renderWaitEnabled) {
      const timeout = promptContext.renderWaitTimeoutMs || 5000;
      const pollInterval = 500;

      logger.info({
        event: 'visual_triage_waiting_for_images',
        documentId,
        maxWaitMs: timeout
      });
      
      while (images.length === 0 && waitedMs < timeout) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        waitedMs += pollInterval;
        
        // Re-normalize images (might have been updated by background render)
        if (promptContext.refreshImages && typeof promptContext.refreshImages === 'function') {
          const refreshed = await promptContext.refreshImages();
          const newlyFound = this._normalizeImages(refreshed).slice(0, this.options.maxPages);
          if (newlyFound.length > 0) {
            images = newlyFound;
            logger.info({
              event: 'visual_triage_images_resolved_after_wait',
              documentId,
              imageCount: images.length,
              waitedMs
            });
          }
        }
      }
    }

    if (images.length === 0) {
      return this._buildFallback('no_images', startMs, {
        documentId,
        waitedMs
      });
    }

    if (!this.ollamaService || typeof this.ollamaService.chat !== 'function') {
      return this._buildFallback('ollama_unavailable', startMs, {
        documentId,
        pagesAnalyzed: images.length
      });
    }

    const execution = await this.circuitBreaker.execute(
      () => this._queryVisionModel(images, promptContext),
      {
        timeout: this.options.timeout,
        retries: this.options.maxRetries
      }
    );

    if (!execution.success) {
      const reason =
        execution.circuitState === CircuitState.OPEN
          ? 'circuit_open'
          : 'vision_query_failed';
      return this._buildFallback(reason, startMs, {
        documentId,
        pagesAnalyzed: images.length,
        circuitState: execution.circuitState
      });
    }

    const parsed = this._extractClassification(execution.data);
    const domain = this._mapClassificationToDomain(parsed.domainHint || parsed.raw);
    const confidence = this._calculateConfidence(execution.data, parsed, domain);
    const latencyMs = Date.now() - startMs;

    const domainLabel = DOMAIN_LABELS[domain] || DOMAIN_LABELS.general;
    const hasSpecificDomain = domain !== 'general';
    const qualityAssessment = parsed.qualityAssessment || {
      visual_clarity: 'medium',
      text_legibility: 'medium',
      completeness: 'partial',
      issues: []
    };

    const result = {
      classification: {
        primary_domain: domainLabel,
        document_type: parsed.documentType || 'unknown',
        confidence,
        evidence: parsed.evidence || []
      },
      routing: {
        requires_visual_analysis: true,
        requires_expert_model: hasSpecificDomain
      },
      quality_assessment: qualityAssessment,
      domain,
      confidence,
      _meta: {
        parsed: parsed.parsed,
        source: 'visual_triage',
        model: this.options.model,
        latencyMs,
        pagesAnalyzed: images.length,
        circuitState: execution.circuitState || this.circuitBreaker.getState()
      }
    };

    logger.info({
      event: 'visual_triage_classification_complete',
      documentId,
      domain,
      confidence,
      pagesAnalyzed: images.length,
      latencyMs,
      model: this.options.model,
      circuitState: result._meta.circuitState
    });

    return result;
  }

  async _queryVisionModel(images, promptContext = {}) {
    const variables = {
      source_system: promptContext.source_system || promptContext.source || 'paperless-ngx',
      filename: promptContext.filename || 'unknown',
      resolution: promptContext.resolution || 'standard',
      file_size: promptContext.file_size || promptContext.fileSize || 'unknown'
    };

    const messages = promptRegistry.buildMessages(
      this.options.promptId,
      variables,
      images
    );

    return this.ollamaService.chat({
      model: this.options.model,
      messages,
      options: promptRegistry.getOptions(this.options.promptId),
      stream: false
    });
  }

  _normalizeImages(pageImages) {
    if (Array.isArray(pageImages)) {
      return pageImages.filter(image => typeof image === 'string' && image.length > 0);
    }

    if (typeof pageImages === 'string' && pageImages.length > 0) {
      return [pageImages];
    }

    if (pageImages && typeof pageImages === 'object') {
      const resolved = resolveDocumentImages(pageImages);
      if (Array.isArray(resolved.base64Images)) {
        return resolved.base64Images.filter(
          image => typeof image === 'string' && image.length > 0
        );
      }
    }

    return [];
  }

  _extractClassification(response) {
    const raw = this._extractResponseContent(response);
    const parsed = {
      raw,
      parsed: false,
      hasStructuredJson: false,
      hasCategoryFormat: false,
      domainHint: null,
      documentType: 'unknown',
      modelConfidence: null,
      qualityAssessment: null,
      evidence: []
    };

    const asObject = this._extractJsonObject(raw);
    if (asObject && typeof asObject === 'object') {
      parsed.parsed = true;
      parsed.hasStructuredJson = true;
      parsed.domainHint =
        asObject?.classification?.primary_domain ||
        asObject?.primary_domain ||
        asObject?.domain ||
        null;
      parsed.documentType =
        asObject?.classification?.document_type ||
        asObject?.document_type ||
        'unknown';
      parsed.modelConfidence =
        asObject?.classification?.confidence ??
        asObject?.confidence ??
        null;
      parsed.qualityAssessment = asObject?.quality_assessment || null;

      if (Array.isArray(asObject?.classification?.evidence)) {
        parsed.evidence = asObject.classification.evidence.slice(0, 3);
      }
    }

    const categoryMatch = raw.match(
      /Category:\s*(Financial|Medical|Legal|General)\b/i
    );
    if (categoryMatch) {
      parsed.domainHint = categoryMatch[1];
      parsed.hasCategoryFormat = true;
    }

    const reasonMatch = raw.match(/Reason:\s*([^\n\r]+)/i);
    if (reasonMatch) {
      parsed.hasCategoryFormat = true;
      const reason = reasonMatch[1].trim();
      if (reason.length > 0) {
        parsed.evidence = [reason];
      }
    }

    return parsed;
  }

  _extractResponseContent(response) {
    if (typeof response === 'string') {
      return response;
    }

    if (response?.message?.content) {
      return String(response.message.content);
    }

    if (response?.response) {
      return String(response.response);
    }

    return JSON.stringify(response || {});
  }

  _extractJsonObject(raw) {
    if (!raw || typeof raw !== 'string') {
      return null;
    }

    // 1) Handle closed/unclosed thinking tags
    const cleaned = stripThinkingTags(raw);
    if (!cleaned) return null;

    // 2) Try direct parse
    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
      try {
        return JSON.parse(cleaned);
      } catch (e) { /* fallthrough */ }
    }

    // 3) Try Markdown code fences
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
      const content = fenceMatch[1].trim();
      try { return JSON.parse(content); } catch (e) {
        const innerBraceMatch = content.match(/\{[\s\S]*\}/);
        if (innerBraceMatch) {
          try { return JSON.parse(innerBraceMatch[0]); } catch (e2) { /* fallthrough */ }
        }
      }
    }

    // 4) Try braced JSON extraction
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch (error) {
      void error;
      return null;
    }
  }

  _mapClassificationToDomain(classification) {
    const raw = String(classification || '').toLowerCase();

    if (raw.includes('financial')) return 'financial';
    if (raw.includes('medical')) return 'medical';
    if (raw.includes('legal')) return 'legal';
    if (raw.includes('general')) return 'general';

    if (/(invoice|receipt|payment|tax|bank)/i.test(raw)) return 'financial';
    if (/(patient|diagnosis|prescription|doctor|lab)/i.test(raw)) {
      return 'medical';
    }
    if (/(contract|agreement|clause|court|legal)/i.test(raw)) return 'legal';

    return 'general';
  }

  _calculateConfidence(response, parsed, domain) {
    let heuristic = 0.5;

    if (parsed.hasStructuredJson) {
      heuristic += 0.2;
    }

    if (parsed.hasCategoryFormat) {
      heuristic += 0.2;
    }

    const raw = parsed.raw || this._extractResponseContent(response);
    const keywordHits = this._countDomainKeywords(raw, domain);
    heuristic += Math.min(keywordHits * 0.05, 0.3);

    if (Array.isArray(parsed.evidence) && parsed.evidence.length > 0) {
      heuristic += 0.05;
    }

    heuristic = Math.min(1, Math.max(0, heuristic));

    const modelConfidence = Number(parsed.modelConfidence);
    if (Number.isFinite(modelConfidence)) {
      const weighted = modelConfidence * 0.7 + heuristic * 0.3;
      return Math.round(Math.min(1, Math.max(0, weighted)) * 1000) / 1000;
    }

    return Math.round(heuristic * 1000) / 1000;
  }

  _countDomainKeywords(text, domain) {
    const lower = String(text || '').toLowerCase();
    const keywords = {
      financial: ['invoice', 'payment', 'tax', 'receipt', 'bank'],
      medical: ['patient', 'diagnosis', 'prescription', 'lab', 'doctor'],
      legal: ['contract', 'agreement', 'party', 'clause', 'legal'],
      general: ['letter', 'memo', 'correspondence']
    };

    const selected = keywords[domain] || keywords.general;
    return selected.reduce((count, keyword) => {
      if (lower.includes(keyword)) {
        return count + 1;
      }
      return count;
    }, 0);
  }

  _buildFallback(reason, startMs, meta = {}) {
    const latencyMs = Date.now() - startMs;

    logger.warn({
      event: 'visual_triage_fallback',
      reason,
      latencyMs,
      model: this.options.model,
      ...meta
    });

    return {
      classification: {
        primary_domain: DOMAIN_LABELS.general,
        document_type: 'unknown',
        confidence: 0.1,
        evidence: [`fallback:${reason}`]
      },
      routing: {
        requires_visual_analysis: false,
        requires_expert_model: false
      },
      quality_assessment: {
        visual_clarity: 'low',
        text_legibility: 'low',
        completeness: 'partial',
        issues: [reason]
      },
      domain: 'general',
      confidence: 0.1,
      _meta: {
        parsed: false,
        source: 'visual_triage',
        fallback: true,
        reason,
        latencyMs,
        model: this.options.model,
        circuitState: meta.circuitState || this.circuitBreaker.getState()
      }
    };
  }
}

module.exports = {
  VisualTriageService
};

