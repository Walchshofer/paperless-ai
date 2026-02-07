const config = require('../../config/config');
const routingConfig = require('../../config/routing');
const healthMetricsService = require('../HealthMetricsService');
const logger = require('../logger');

module.exports = {
    /**
     * Merge text and vision analysis results
     * Vision results take priority for visual elements (tables, amounts)
     * Text results used for language and contextual understanding
     * @param {Object} textResult - Result from text analysis
     * @param {Object} visionResult - Result from vision analysis
     * @returns {Object} Merged result
     */
    _mergeAnalysisResults(textResult, visionResult, options = {}) {
        const textDoc = textResult.document || {};
        const visionDoc = visionResult.document || {};
        const threshold = options.threshold ?? config.visualRag.textQualityThreshold;
        const preferVisionFields = options.mode === 'SEQUENTIAL'
            || (typeof options.quality === 'number' && options.quality < threshold);

        // Merge tags: union, deduplicated
        const mergedTags = [...new Set([
            ...(textDoc.tags || []),
            ...(visionDoc.tags || [])
        ])];

        // Vision takes priority for correspondent (better at reading letterheads)
        const correspondent = visionDoc.correspondent || textDoc.correspondent;

        // Vision takes priority for title (better at reading headers)
        const title = visionDoc.title || textDoc.title;

        // Vision takes priority for document_type when text quality is weak or in sequential mode
        const document_type = preferVisionFields
            ? (visionDoc.document_type || textDoc.document_type)
            : (textDoc.document_type || visionDoc.document_type);

        // Prefer vision for date when text quality is weak or in sequential mode
        const document_date = preferVisionFields
            ? (visionDoc.document_date || textDoc.document_date)
            : (textDoc.document_date || visionDoc.document_date);

        // Prefer text for language detection
        const language = textDoc.language || visionDoc.language;

        // Merge custom fields: vision takes priority (better at reading tables/amounts)
        const custom_fields = {
            ...(textDoc.custom_fields || {}),
            ...(visionDoc.custom_fields || {})
        };

        return {
            document: {
                title,
                correspondent,
                tags: mergedTags,
                document_type,
                document_date,
                language,
                custom_fields
            },
            metrics: {
                promptTokens: (textResult.metrics?.promptTokens || 0) + (visionResult.metrics?.promptTokens || 0),
                completionTokens: (textResult.metrics?.completionTokens || 0) + (visionResult.metrics?.completionTokens || 0),
                totalTokens: (textResult.metrics?.totalTokens || 0) + (visionResult.metrics?.totalTokens || 0),
                processingTime: (parseFloat(textResult.metrics?.processingTime || 0) + parseFloat(visionResult.metrics?.processingTime || 0)).toFixed(2)
            },
            truncated: textResult.truncated || visionResult.truncated || false,
            _analysisMode: 'SEQUENTIAL',
            _sources: {
                text: textDoc,
                vision: visionDoc
            }
        };
    },

    /**
     * Derive a human-readable fallback reason from validation results.
     * @param {Object} validation - Validation result with missingFields, lowConfidenceFields, score
     * @returns {string} Reason code: 'missing_fields' | 'low_confidence' | 'low_score' | 'unknown'
     */
    _deriveFallbackReason(validation) {
        if (!validation) return 'unknown';
        if (validation.missingFields && validation.missingFields.length > 0) {
            return 'missing_fields';
        }
        if (validation.lowConfidenceFields && validation.lowConfidenceFields.length > 0) {
            return 'low_confidence';
        }
        if (typeof validation.score === 'number' && validation.score < 1) {
            return 'low_score';
        }
        return 'unknown';
    },

    /**
     * Store health biomarker metrics from extraction results into HealthMetricsService.
     * Only persists when biomarkers are present and the document is classified as medical.
     * @param {number} documentId - Paperless document ID
     * @param {Object} extractionResult - Extraction output with optional biomarkers array
     * @param {Object} plannerResult - Planner classification with category field
     */
    _persistHealthMetrics(documentId, extractionResult, plannerResult) {
        try {
            const biomarkers = extractionResult?.biomarkers;
            if (!Array.isArray(biomarkers) || biomarkers.length === 0) {
                return;
            }

            if (plannerResult?.category && plannerResult.category !== 'medical') {
                return;
            }

            const summary = healthMetricsService.storeMetrics(documentId, {
                test_date: extractionResult.test_date || extractionResult.testDate || null,
                laboratory: extractionResult.laboratory || null,
                biomarkers
            });

            if (summary.inserted > 0) {
                logger.info(`[HEALTH_METRICS] Stored ${summary.inserted} biomarkers for doc ${documentId}`);
            }
        } catch (error) {
            logger.error(`[HEALTH_METRICS] Failed to store metrics for doc ${documentId}: ${error.message}`);
        }
    },

    /**
     * Build routing metadata (pipeline mode, models, expert options) from planner classification.
     * Resolves the recommended model, analysis model, and expert pipeline based on
     * category, modality, and confidence thresholds from routing config.
     * @param {Object} plannerResult - Planner response with category, confidence, modality
     * @returns {Object} Routing metadata with pipeline, models, and expert flags
     */
    _buildRoutingMetadata(plannerResult) {
        const category = (plannerResult?.category || 'general').toLowerCase();
        const categoryConfig = routingConfig.categories[category] || routingConfig.categories.general;
        const confidence = typeof plannerResult?.confidence === 'number' ? plannerResult.confidence : 0;
        const modality = plannerResult?.modality || 'unknown';

        const expertPipeline = categoryConfig?.expertPipeline || null;
        const expertConfig = expertPipeline ? routingConfig.expertPipelines[expertPipeline] : null;
        const expertActive = config.expertPipelineEnabled === 'yes'
            && expertConfig?.status === 'active'
            && confidence >= (expertConfig?.minConfidence || 0.7);

        const modalityConfig = categoryConfig?.modalityRouting?.[modality] || null;

        let recommendedModel = config.ollama.model;
        let analysisModel = null;
        let fallbackModel = null;
        let pipeline = 'text_only';

        if (categoryConfig?.preferVision) {
            recommendedModel = config.ollama.visionModel;
            pipeline = 'vision_only';
            if (categoryConfig.fallbackToText) {
                fallbackModel = config.ollama.model;
            }
        }

        if (expertActive && modalityConfig) {
            pipeline = modalityConfig.pipeline;
            analysisModel = modalityConfig.analysisModel;
        }

        return {
            pipeline,
            expertPipeline: expertActive ? expertPipeline : null,
            expertOptions: ['medical', 'financial', 'legal'],
            modality,
            recommendedModel,
            analysisModel,
            fallbackModel,
            routingConfidence: confidence,
            requiresExpertExtraction: expertActive
        };
    },

    /**
     * Resolve Ollama context window and response token limits for a given tier and model.
     * Priority: per-model overrides > tier-specific config > base text config > env TOKEN_LIMIT.
     * @param {string} [kind='text'] - Token limit tier: 'text' | 'vision' | 'planner' | 'expert' | 'translation'
     * @param {string|null} [modelName=null] - Optional model name for per-model overrides
     * @returns {{ contextWindow: number, maxResponseTokens: number, source: string, modelKey: string|null }}
     */
    _resolveOllamaLimits(kind = 'text', modelName = null) {
        const limits = config.ollama?.limits || {};
        const base = limits.text || {};
        const selected = limits[kind] || {};
        const modelLimits = config.ollama?.modelLimits || {};
        let modelOverride = null;
        let modelKey = null;
        if (modelName && typeof modelLimits === 'object') {
            const normalized = String(modelName).toLowerCase();
            modelKey = Object.keys(modelLimits).find((key) => key.toLowerCase() === normalized);
            if (modelKey) {
                const candidate = modelLimits[modelKey];
                if (candidate && typeof candidate === 'object') {
                    modelOverride = candidate[kind] || candidate;
                }
            }
        }

        const contextWindow = Number.isFinite(modelOverride?.contextWindow)
            ? modelOverride.contextWindow
            : (Number.isFinite(selected.contextWindow)
                ? selected.contextWindow
                : (Number.isFinite(base.contextWindow)
                    ? base.contextWindow
                    : parseInt(config.tokenLimit || '16384', 10)));
        const maxResponseTokens = Number.isFinite(modelOverride?.maxResponseTokens)
            ? modelOverride.maxResponseTokens
            : (Number.isFinite(selected.maxResponseTokens)
                ? selected.maxResponseTokens
                : (Number.isFinite(base.maxResponseTokens)
                    ? base.maxResponseTokens
                    : 0));
        return {
            contextWindow,
            maxResponseTokens,
            source: modelOverride ? 'model_limits' : 'defaults',
            modelKey
        };
    },

    /**
     * Calculate the effective context window by applying a safety factor to the raw limit.
     * GPT-OSS models use 90% factor; standard Ollama models use 80%.
     * @param {number|string} [contextWindowOverride] - Override for the raw context window
     * @returns {number} Effective context window in tokens
     */
    _getEffectiveContextWindow(contextWindowOverride) {
        const maxLimit = parseInt(contextWindowOverride || config.tokenLimit || '16384', 10);
        const factor = this.isGptOss ? 0.90 : 0.80;
        return Math.floor(maxLimit * factor);
    },

    /**
     * Calculate the optimal num_ctx value for an Ollama request.
     * Clamps to the effective context window to prevent OOM errors.
     * @param {number} promptTokenCount - Estimated prompt token count
     * @param {number} responseTokens - Reserved response tokens
     * @param {number|string} [contextWindowOverride] - Context window override
     * @returns {number} num_ctx value to pass to Ollama
     */
    _calculateNumCtx(promptTokenCount, responseTokens, contextWindowOverride) {
        const total = promptTokenCount + responseTokens;
        const safeLimit = this._getEffectiveContextWindow(contextWindowOverride);
        return Math.min(total, safeLimit);
    },

    /**
     * Safely stringify a value with circular reference protection, embedding omission, and truncation.
     * @param {*} value - Value to serialize
     * @param {number} [maxLength=8000] - Maximum output length before truncation
     * @returns {string} JSON string or String(value) fallback
     */
    _safeStringify(value, maxLength = 8000) {
        try {
            const seen = new WeakSet();
            const replacer = (key, val) => {
                if (key === 'context' || key === 'embedding' || key === 'embeddings') {
                    if (Array.isArray(val)) {
                        return `[omitted ${key} array length=${val.length}]`;
                    }
                    return `[omitted ${key}]`;
                }
                if (Array.isArray(val)) {
                    const isNumericArray = val.length > 50 && val.every(item => typeof item === 'number');
                    if (isNumericArray) {
                        return `[omitted numeric array length=${val.length}]`;
                    }
                }
                if (val && typeof val === 'object') {
                    if (seen.has(val)) {
                        return '[circular]';
                    }
                    seen.add(val);
                }
                return val;
            };
            const serialized = JSON.stringify(value, replacer, 2);
            if (typeof serialized !== 'string') return String(value);
            if (serialized.length > maxLength) {
                return `${serialized.substring(0, maxLength)}... [truncated ${serialized.length} chars]`;
            }
            return serialized;
        } catch (error) {
            return String(value);
        }
    },

    /**
     * Log an Ollama response at debug level with safe serialization.
     * @param {string} prefix - Log prefix for identification
     * @param {*} data - Response data to log
     */
    _logOllamaResponse(prefix, data) {
        const dump = this._safeStringify(data);
        logger.debug(`[DEBUG] ${prefix} ${dump}`);
    },

    /**
     * Extract the raw text content from various Ollama response formats.
     * Checks response.response, message.content, and thinking fields in order.
     * @param {Object} responseData - Raw Ollama API response
     * @returns {string|null} Extracted text or null if none found
     */
    _extractRawOllamaText(responseData) {
        if (typeof responseData?.response === 'string' && responseData.response.trim().length > 0) {
            return responseData.response;
        }
        if (typeof responseData?.message?.content === 'string') {
            return responseData.message.content;
        }
        if (typeof responseData?.thinking === 'string') {
            return responseData.thinking;
        }
        return null;
    },

    /**
     * Strip reasoning tags, large arrays, and truncate oversized text for JSON repair.
     * @param {string} rawText - Raw text that may contain thinking tags and large arrays
     * @returns {string} Cleaned text suitable for JSON parsing
     */
    _sanitizeRepairText(rawText) {
        let cleaned = rawText || '';
        // Strip Dragon/Claude/other reasoning tags and their contents
        cleaned = cleaned.replace(/<\s*(think|thinking|reasoning)[^>]*>[\s\S]*?<\/\s*(think|thinking|reasoning)\s*>/gi, '');
        // Replace known large arrays in JSON-like text
        cleaned = cleaned.replace(/"(context|embedding|embeddings)"\s*:\s*\[[\s\S]*?\]/gi, '"$1":"[OMITTED_ARRAY]"');
        // Heuristic: replace very large arrays anywhere with a placeholder
        cleaned = cleaned.replace(/\[[\s\S]{200,}\]/g, '[OMITTED_ARRAY]');
        // Numeric arrays with many elements get a special placeholder
        cleaned = cleaned.replace(/\[(?:\s*-?\d+(?:\.\d+)?\s*,){50,}\s*-?\d+(?:\.\d+)?\s*\]/g, '[OMITTED_NUMERIC_ARRAY]');
        if (cleaned.length > 12000) {
            cleaned = `${cleaned.substring(0, 12000)}... [truncated ${cleaned.length} chars]`;
        }
        return cleaned.trim();
    },

    /**
     * Build a fallback document when AI extraction fails and user review is needed.
     * @returns {Object} Document with 'User Review Required' title and 'USER REVIEW' tag
     */
    _buildUserReviewFallback() {
        return {
            title: 'User Review Required',
            correspondent: 'AI User',
            tags: ['USER REVIEW'],
            document_type: 'note',
            document_date: new Date().toISOString().slice(0, 10),
            language: 'de',
            custom_fields: {}
        };
    },

    /**
     * Apply sensible defaults for note-type documents (correspondent='AI User', date=today).
     * Only triggers for document types: note, memo, list, notiz, notizen.
     * @param {Object} document - Document to check and augment
     * @returns {Object} Document with defaults applied if it's a note type
     */
    _applyNoteDefaults(document) {
        if (!document || typeof document !== 'object') return document;
        const documentType = document.document_type ? String(document.document_type).toLowerCase() : '';
        const isNote = ['note', 'memo', 'list', 'notiz', 'notizen'].includes(documentType);
        if (!isNote) return document;

        return {
            ...document,
            correspondent: document.correspondent || 'AI User',
            document_date: document.document_date || new Date().toISOString().slice(0, 10)
        };
    },

    /**
     * Normalize date values from various formats to YYYY-MM-DD.
     * Handles Date objects, ISO strings, DD.MM.YYYY, and other parseable formats.
     * @param {Date|string|null} value - Date value in any supported format
     * @returns {string|null} Date in YYYY-MM-DD format, or null if unparseable
     */
    _normalizeDateInput(value) {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.valueOf())) {
            return value.toISOString().slice(0, 10);
        }
        const raw = String(value).trim();
        if (!raw) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            return raw;
        }
        const dotMatch = raw.match(/^(\d{2})[.\-/](\d{2})[.\-/](\d{4})$/);
        if (dotMatch) {
            return `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`;
        }
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.valueOf())) {
            return parsed.toISOString().slice(0, 10);
        }
        return null;
    },

    /**
     * Apply legacy vision-mode fallbacks for document type, date, language, and verification tags.
     * Used when vision analysis returns incomplete results.
     * @param {Object} document - Extracted document data
     * @param {Object} [options={}] - Options with optional documentCreated date
     * @returns {Object} Document with fallback values applied
     */
    _applyLegacyVisionFallbacks(document, options = {}) {
        if (!document || typeof document !== 'object') return document;

        const updated = { ...document };
        const documentType = typeof updated.document_type === 'string'
            ? updated.document_type.trim()
            : '';
        if (!documentType) {
            updated.document_type = 'Notiz';
        }

        if (!updated.document_date) {
            const fallbackDate = this._normalizeDateInput(options.documentCreated)
                || this._normalizeDateInput(new Date());
            if (fallbackDate) {
                updated.document_date = fallbackDate;
            }
        }

        if (!updated.language) {
            updated.language = 'de';
        }

        const title = typeof updated.title === 'string' ? updated.title.trim() : '';
        if (title && title.toLowerCase() === 'notiz') {
            const tags = Array.isArray(updated.tags) ? [...updated.tags] : [];
            const hasVerificationTag = tags.some(tag =>
                String(tag).trim().toLowerCase() === 'verification needed'
            );
            if (!hasVerificationTag) {
                tags.push('Verification needed');
            }
            updated.tags = tags;
        }

        return updated;
    },

    /**
     * Normalize extraction output to a canonical document shape with safe defaults.
     * Ensures tags is an array, custom_fields values are normalized, and missing fields are null.
     * @param {Object} data - Raw extraction output
     * @returns {Object} Normalized document with tags, correspondent, title, dates, type, language, custom_fields
     */
    _normalize(data) {
        const normalizedData = (data && typeof data === 'object') ? data : {};
        const customFields = (normalizedData && typeof normalizedData.custom_fields === 'object' && !Array.isArray(normalizedData.custom_fields))
            ? normalizedData.custom_fields
            : {};

        const { normalizeCustomFieldValue } = require('../customFieldUtils');
        const normalizedCustomFields = {};
        for (const k of Object.keys(customFields || {})) {
            normalizedCustomFields[k] = normalizeCustomFieldValue(customFields[k]);
        }

        return {
            tags: Array.isArray(normalizedData.tags) ? normalizedData.tags : [],
            correspondent: normalizedData.correspondent || null,
            title: normalizedData.title || null,
            document_date: normalizedData.document_date || null,
            document_type: normalizedData.document_type || null,
            language: normalizedData.language || null,
            custom_fields: normalizedCustomFields
        };
    },

    /**
     * Return an empty document template with all fields set to null/defaults.
     * @returns {Object} Empty document shape matching the canonical extraction format
     */
    _emptyDocument() {
        return {
            title: null,
            correspondent: null,
            tags: [],
            document_type: null,
            document_date: null,
            language: null,
            custom_fields: {}
        };
    },

    /**
     * Validate a planner response for required fields and allowed values.
     * Checks category against allowed list and modality for medical documents.
     * @param {Object} response - Planner response to validate
     * @returns {{ valid: boolean, errors: string[] }} Validation result
     */
    _validatePlannerResponse(response) {
        const errors = [];
        const allowedCategories = ['financial', 'medical', 'legal', 'technical', 'personal', 'general'];
        const allowedModalities = ['lab', 'radiology', 'prescription', 'unknown'];

        if (!response || typeof response !== 'object' || Array.isArray(response)) {
            errors.push('response is not an object');
            return { valid: false, errors };
        }

        const requiredFields = ['category', 'doc_type_hint', 'confidence', 'keywords', 'needs_visual'];
        requiredFields.forEach((field) => {
            if (!(field in response)) {
                errors.push(`missing ${field}`);
            }
        });

        if (typeof response.category !== 'string' || !allowedCategories.includes(response.category)) {
            errors.push('invalid category');
        }

        if ('doc_type_hint' in response && response.doc_type_hint !== null && typeof response.doc_type_hint !== 'string') {
            errors.push('invalid doc_type_hint');
        }

        if (typeof response.confidence !== 'number' || Number.isNaN(response.confidence) || response.confidence < 0 || response.confidence > 1) {
            errors.push('invalid confidence');
        }

        if (!Array.isArray(response.keywords)) {
            errors.push('invalid keywords');
        }

        if (typeof response.needs_visual !== 'boolean') {
            errors.push('invalid needs_visual');
        }

        if ('rotation_degrees' in response) {
            const degrees = Number(response.rotation_degrees);
            const allowedRotations = [0, 90, 180, 270];
            if (!Number.isFinite(degrees) || !allowedRotations.includes(degrees)) {
                errors.push('invalid rotation_degrees');
            }
        }

        if (response.category === 'medical') {
            if (!response.modality || !allowedModalities.includes(response.modality)) {
                errors.push('invalid or missing modality for medical document');
            }
        }

        return { valid: errors.length === 0, errors };
    },

    /**
     * Assess text quality score (0-100)
     * Higher scores indicate better OCR quality
     * @param {string} content - Document text content
     * @returns {number} Quality score 0-100
     */
    _assessTextQuality(content) {
        if (!content || content.length < 50) return 0;

        const words = content.split(/\s+/);
        const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
        const specialCharRatio = (content.match(/[^\w\s]/g) || []).length / content.length;

        let score = 100;

        // Penalize short average word length (OCR artifacts)
        if (avgWordLength < 3) score -= 30;

        // Penalize high special character ratio (OCR noise)
        if (specialCharRatio > 0.15) score -= 30;

        // Penalize very short documents
        if (words.length < 20) score -= 20;

        return Math.max(0, score);
    },

    /**
     * Detect visual complexity patterns in text
     * @param {string} content - Document text content
     * @returns {string[]} Array of detected patterns (table, form, columns)
     */
    _detectVisualComplexity(content) {
        const flags = [];

        // Detect tables (multiple pipe characters)
        if ((content.match(/\|/g) || []).length > 5) {
            flags.push('table');
        }

        // Detect forms (checkbox patterns)
        if (/\[\s*[xX]?\s*\]/.test(content)) {
            flags.push('form');
        }

        // Detect multi-column layout (multiple spaces between words)
        if (/^\s{2,}\S+\s{2,}\S+/m.test(content)) {
            flags.push('columns');
        }

        return flags;
    },

    /**
     * Determine analysis mode based on text quality and configuration
     * @param {string} content - Document text content
     * @returns {string} Analysis mode: TEXT_ONLY, VISION_ONLY, or SEQUENTIAL
     */
    _determineAnalysisMode(content) {
        // If Visual RAG is disabled, use text-only mode
        if (!config.visualRag.enabled) {
            return 'TEXT_ONLY';
        }

        // If force vision is enabled, always use vision
        if (config.visualRag.forceVision) {
            return 'VISION_ONLY';
        }

        // Assess text quality
        const quality = this._assessTextQuality(content);
        const complexity = this._detectVisualComplexity(content);

        logger.debug(`[ANALYSIS] Text quality: ${quality}, Complexity flags: ${complexity.join(', ') || 'none'}`);

        // Very low quality - go straight to vision
        if (quality < 40) {
            return 'VISION_ONLY';
        }

        // High quality and low complexity - text is sufficient
        if (quality >= 70 && complexity.length < 2) {
            return 'TEXT_ONLY';
        }

        // Medium quality or complex layout - use sequential analysis
        return 'SEQUENTIAL';
    }
};
