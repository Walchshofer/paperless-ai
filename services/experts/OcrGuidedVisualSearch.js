/**
 * OcrGuidedVisualSearch.js
 *
 * OCR-guided visual search refinement for low-confidence visual extraction.
 * Uses Paperless OCR text to generate targeted visual queries and
 * cross-validates results with an expert model.
 */

const axios = require('axios');
const config = require('../../config/config');
const logger = require('../logger');
const paperlessService = require('../paperlessService');
const { metricsCollector } = require('../metrics/PrometheusMetrics');
const { promptRegistry } = require('../prompts/PromptRegistry');

const DEFAULT_CONFIG = {
    maxQueries: 5,
    maxQueryLength: 140,
    minValueLength: 3,
    maxKeyTerms: 12,
    minOcrLength: 20,
    maxOcrChars: 2000,
    ocrFetchTimeoutMs: 1500,
    crossValidationTimeoutMs: 1500,
    crossValidationEnabled: true,
    promptId: 'OCR_GUIDED_CROSS_VALIDATE_V1'
};

class OcrGuidedVisualSearch {
    constructor(options = {}) {
        this.paperlessService = options.paperlessService || paperlessService;
        this.metricsCollector = options.metricsCollector || metricsCollector || null;
        this.config = {
            ...DEFAULT_CONFIG,
            ...options
        };

        const baseUrl = config.ollama?.apiUrl ||
            process.env.OLLAMA_HOST ||
            'http://localhost:11434';
        this.ollamaClient = options.ollamaClient || axios.create({
            baseURL: baseUrl.replace(/\/$/, ''),
            timeout: this.config.crossValidationTimeoutMs
        });
    }

    async searchWithOcrGuidance(visualResult, documentId, domain, options = {}) {
        const startTime = options.startTime || Date.now();
        const result = visualResult || {};
        const documentImage = options.documentImage || null;
        const visualQueries = options.visualQueries || [];
        const extractionResults = options.extractionResults || {};
        const documentMetadata = options.documentMetadata || {};
        const requestId = options.requestId || documentMetadata.requestId || null;
        const docTypeLabel = documentMetadata.documentType || domain || 'general';
        const recordOutcome = (outcome) => {
            if (this.metricsCollector?.recordOcrGuidedFallback) {
                this.metricsCollector.recordOcrGuidedFallback(docTypeLabel, outcome);
            }
        };

        if (!documentId) {
            return result;
        }

        if (!documentImage) {
            logger.info({
                event: 'visual_query_ocr_fallback_skipped',
                documentId,
                reason: 'no_image'
            });
            recordOutcome('skipped');
            return result;
        }

        if (!this.paperlessService ||
            typeof this.paperlessService.getDocumentContent !== 'function') {
            logger.info({
                event: 'visual_query_ocr_fallback_skipped',
                documentId,
                reason: 'paperless_unavailable'
            });
            recordOutcome('skipped');
            return result;
        }

        let ocrText = '';
        try {
            ocrText = await this._withTimeout(
                this.paperlessService.getDocumentContent(documentId),
                this.config.ocrFetchTimeoutMs,
                'OCR fetch timeout'
            );
        } catch (error) {
            logger.warn({
                event: 'visual_query_ocr_fallback_failed',
                documentId,
                error: error.message
            });
            recordOutcome('failed');
            return {
                ...result,
                execution_metadata: {
                    ...result.execution_metadata,
                    ocr_fallback_used: false,
                    ocr_fallback_error: error.message
                }
            };
        }

        const normalizedOcr = this._truncateOcrText(ocrText);
        if (!normalizedOcr || normalizedOcr.length < this.config.minOcrLength) {
            logger.info({
                event: 'visual_query_ocr_fallback_skipped',
                documentId,
                reason: 'ocr_too_short'
            });
            recordOutcome('skipped');
            return result;
        }

        const ocrGuidedQueries = this._generateOcrGuidedQueries(
            normalizedOcr,
            result.fields || [],
            visualQueries
        );

        if (ocrGuidedQueries.length === 0) {
            logger.info({
                event: 'visual_query_ocr_fallback_skipped',
                documentId,
                reason: 'no_ocr_context'
            });
            recordOutcome('skipped');
            return {
                ...result,
                execution_metadata: {
                    ...result.execution_metadata,
                    ocr_text_length: normalizedOcr.length,
                    ocr_text_sample: normalizedOcr.slice(0, 120),
                    ocr_fallback_used: false
                }
            };
        }

        if (typeof options.executeQueries !== 'function') {
            logger.warn({
                event: 'visual_query_ocr_fallback_skipped',
                documentId,
                reason: 'execute_queries_unavailable'
            });
            recordOutcome('skipped');
            return result;
        }

        logger.info({
            event: 'visual_query_ocr_fallback_triggered',
            documentId,
            visualConfidence: result.execution_metadata?.visual_confidence,
            queryCount: ocrGuidedQueries.length
        });

        const fallbackResults = await options.executeQueries(
            ocrGuidedQueries,
            documentImage,
            documentMetadata
        );

        const fallbackDeduped = typeof options.deduplicateBoundingBoxes === 'function'
            ? options.deduplicateBoundingBoxes(fallbackResults)
            : [];

        const combinedDeduped = typeof options.deduplicateCandidates === 'function'
            ? options.deduplicateCandidates([
                ...(Array.isArray(options.dedupedResults)
                    ? options.dedupedResults
                    : []),
                ...fallbackDeduped
            ])
            : fallbackDeduped;

        const mergedFields = typeof options.mergeResults === 'function'
            ? options.mergeResults(extractionResults, combinedDeduped, visualQueries)
            : (result.fields || []);

        const overlays = typeof options.calculateOverlays === 'function'
            ? options.calculateOverlays(combinedDeduped)
            : (result.overlays || []);

        const combinedQueryResults = [
            ...(Array.isArray(options.queryResults) ? options.queryResults : []),
            ...(Array.isArray(fallbackResults) ? fallbackResults : [])
        ];

        const kValues = typeof options.buildKValues === 'function'
            ? options.buildKValues(combinedQueryResults)
            : [];
        const dedupStats = typeof options.buildDedupStats === 'function'
            ? options.buildDedupStats(combinedQueryResults, combinedDeduped)
            : {};
        const visualConfidence = typeof options.calculateVisualConfidence === 'function'
            ? options.calculateVisualConfidence(combinedQueryResults)
            : result.execution_metadata?.visual_confidence;

        const metadata = typeof options.buildMetadata === 'function'
            ? options.buildMetadata(combinedQueryResults, startTime, {
                kValues,
                dedupStats,
                visualConfidence
            })
            : { ...(result.execution_metadata || {}) };

        metadata.ocr_fallback_used = true;
        metadata.ocr_fallback_visual_confidence_before =
            result.execution_metadata?.visual_confidence ?? null;
        metadata.ocr_fallback_visual_confidence_after = visualConfidence;
        metadata.ocr_guided_query_count = ocrGuidedQueries.length;
        metadata.ocr_guided_hit_count = fallbackDeduped.length;
        metadata.ocr_guided_query_examples = ocrGuidedQueries
            .slice(0, 3)
            .map(query => query.question);
        metadata.ocr_text_length = normalizedOcr.length;
        metadata.ocr_text_sample = normalizedOcr.slice(0, 120);
        if (Number.isFinite(options.confidenceThreshold)) {
            metadata.ocr_fallback_confidence_threshold = options.confidenceThreshold;
        }

        const crossValidationStart = Date.now();
        const crossValidation = await this._crossValidate(
            normalizedOcr,
            mergedFields,
            fallbackDeduped,
            domain,
            requestId
        );
        const crossValidationLatency = Date.now() - crossValidationStart;

        metadata.ocr_cross_validation_used = crossValidation.used;
        metadata.ocr_cross_validation_latency_ms = crossValidationLatency;
        metadata.ocr_cross_validation_corrections = crossValidation.corrections;

        if (this.metricsCollector?.observeOcrGuidedLatency) {
            this.metricsCollector.observeOcrGuidedLatency(
                docTypeLabel,
                Date.now() - startTime
            );
        }
        recordOutcome('used');

        logger.info({
            event: 'visual_query_ocr_fallback_complete',
            documentId,
            ocrGuidedHitCount: fallbackDeduped.length,
            visualConfidence,
            crossValidationUsed: crossValidation.used
        });

        return {
            ...result,
            fields: crossValidation.fields,
            newly_discovered_fields: options.extractNewlyDiscovered
                ? options.extractNewlyDiscovered(crossValidation.fields)
                : result.newly_discovered_fields || [],
            overlays,
            execution_metadata: metadata
        };
    }

    _generateOcrGuidedQueries(ocrText, visualFields, visualQueries = []) {
        if (!ocrText || typeof ocrText !== 'string') {
            return [];
        }

        const keyTerms = this._extractKeyTerms(ocrText);
        const queryByField = new Map();
        for (const query of visualQueries || []) {
            if (query?.field_target) {
                queryByField.set(query.field_target, query);
            }
        }

        const guidedQueries = [];
        const seen = new Set();

        for (const field of visualFields || []) {
            if (!field?.name) {
                continue;
            }

            const fieldName = field.name;
            const baseQuery = queryByField.get(fieldName);
            const expectedType = baseQuery?.expected_element_type || 'validation';
            const confidence = Number.isFinite(baseQuery?.confidence)
                ? baseQuery.confidence
                : (Number.isFinite(field.confidence) ? field.confidence : 0.5);
            const rarityFactor = Number.isFinite(baseQuery?.rarity_factor)
                ? baseQuery.rarity_factor
                : 0.1;

            let ocrValue = this._findFieldInOcr(fieldName, ocrText);
            if (ocrValue && ocrValue.length < this.config.minValueLength) {
                ocrValue = null;
            }
            let question = '';

            if (ocrValue) {
                question = `Find "${fieldName}" with value "${ocrValue}" in the document`;
            } else if (keyTerms.length > 0) {
                question = `Find "${fieldName}" near ${keyTerms.slice(0, 3).join(', ')}`;
            } else if (baseQuery?.question) {
                question = baseQuery.question;
            }

            question = this._sanitizeQueryText(question);
            if (!question) {
                continue;
            }

            const key = question.toLowerCase();
            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            guidedQueries.push({
                question,
                field_target: fieldName,
                expected_element_type: expectedType,
                confidence,
                rarity_factor: rarityFactor,
                ocr_guided: true
            });

            if (guidedQueries.length >= this.config.maxQueries) {
                break;
            }
        }

        return guidedQueries;
    }

    _extractKeyTerms(ocrText) {
        if (!ocrText || typeof ocrText !== 'string') {
            return [];
        }
        const terms = ocrText.match(/\b[A-Z][a-z]+\b|\$[\d,]+\.?\d*/g) || [];
        const deduped = Array.from(new Set(terms.map(term => term.trim())))
            .filter(Boolean);
        return deduped.slice(0, this.config.maxKeyTerms);
    }

    _findFieldInOcr(fieldName, ocrText) {
        if (!fieldName || !ocrText) {
            return null;
        }

        const normalizedName = String(fieldName).toLowerCase();
        const patterns = {
            invoice_number: /(?:Invoice|Rechnung)\s*#?\s*:?\s*([A-Z0-9-]+)/i,
            invoice_amount: /(?:Total|Summe|Amount)\s*:?\s*\$?([\d,]+\.?\d*)/i,
            total_amount: /(?:Total|Summe|Amount)\s*:?\s*\$?([\d,]+\.?\d*)/i,
            document_date: /(?:Date|Datum)\s*:?\s*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
            invoice_date: /(?:Date|Datum)\s*:?\s*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i
        };

        const pattern = patterns[normalizedName];
        if (!pattern) {
            return null;
        }

        const match = ocrText.match(pattern);
        return match ? String(match[1]).trim() : null;
    }

    async _crossValidate(ocrText, visualFields, visualHits, domain, requestId) {
        if (!this.config.crossValidationEnabled) {
            return { fields: visualFields || [], corrections: 0, used: false };
        }

        if (!Array.isArray(visualFields) || visualFields.length === 0) {
            return { fields: visualFields || [], corrections: 0, used: false };
        }

        const promptId = this.config.promptId;
        let messages;
        let modelInfo;
        let options;

        try {
            messages = promptRegistry.buildMessages(promptId, {
                ocr_text: ocrText,
                visual_fields: JSON.stringify(
                    visualFields.map(field => ({
                        name: field.name,
                        value: field.value,
                        confidence: field.confidence,
                        bounding_box: field.bounding_box || null
                    }))
                ),
                visual_hits: JSON.stringify(
                    (visualHits || []).slice(0, 8).map(hit => ({
                        field_target: hit.query?.field_target || null,
                        score: hit.score,
                        page_number: hit.page_number,
                        box: hit.box
                    }))
                ),
                domain: domain || 'general'
            });
            modelInfo = promptRegistry.getModelInfo(promptId);
            options = promptRegistry.getOptions(promptId);
        } catch (error) {
            logger.warn({
                event: 'ocr_guided_cross_validation_skipped',
                reason: 'prompt_registry_error',
                error: error.message
            });
            return { fields: visualFields, corrections: 0, used: false };
        }

        let responseText = '';
        try {
            const headers = requestId ? { 'X-Request-Id': requestId } : {};
            const response = await this.ollamaClient.post('/api/chat', {
                model: modelInfo.model,
                messages,
                options,
                stream: false
            }, { headers });

            responseText = response?.data?.message?.content ||
                response?.data?.response ||
                '';
        } catch (error) {
            logger.warn({
                event: 'ocr_guided_cross_validation_failed',
                error: error.message
            });
            return { fields: visualFields, corrections: 0, used: false };
        }

        const corrections = this._parseCorrections(responseText);
        if (corrections.length === 0) {
            return { fields: visualFields, corrections: 0, used: false };
        }

        const { fields: correctedFields, count } =
            this._applyCorrections(visualFields, corrections);

        return {
            fields: correctedFields,
            corrections: count,
            used: true
        };
    }

    _parseCorrections(responseText) {
        if (!responseText || typeof responseText !== 'string') {
            return [];
        }

        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return [];
        }

        try {
            const parsed = JSON.parse(jsonMatch[0]);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            logger.warn({
                event: 'ocr_guided_cross_validation_parse_failed',
                error: error.message
            });
            return [];
        }
    }

    _applyCorrections(fields, corrections) {
        const correctionsMap = new Map();
        for (const item of corrections || []) {
            if (item?.name) {
                correctionsMap.set(item.name, item);
            }
        }

        let count = 0;
        const updatedFields = (fields || []).map(field => {
            const correction = correctionsMap.get(field.name);
            if (!correction) {
                return field;
            }
            const updated = { ...field, ocr_cross_validated: true };
            if (correction.value !== undefined && correction.value !== null) {
                updated.value = correction.value;
            }
            if (Number.isFinite(correction.confidence)) {
                updated.confidence = correction.confidence;
            }
            count += 1;
            return updated;
        });

        return { fields: updatedFields, count };
    }

    _sanitizeQueryText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (!normalized) {
            return '';
        }
        if (normalized.length <= this.config.maxQueryLength) {
            return normalized;
        }
        return normalized.slice(0, this.config.maxQueryLength).trim();
    }

    _truncateOcrText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (normalized.length <= this.config.maxOcrChars) {
            return normalized;
        }
        return normalized.slice(0, this.config.maxOcrChars).trim();
    }

    async _withTimeout(promise, timeoutMs, message) {
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
            return promise;
        }
        let timer = null;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }
}

module.exports = { OcrGuidedVisualSearch };
