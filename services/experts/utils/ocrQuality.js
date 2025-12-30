/**
 * ocrQuality.js
 *
 * OCR quality scoring and merging utilities.
 * Evaluates OCR output quality and determines optimal source.
 */

const config = require('../../../config/config');
const logger = require('../../logger');

/**
 * Default options for OCR quality assessment
 */
const DEFAULT_QUALITY_OPTIONS = Object.freeze({
    minQuality: 0.6,
    preferVisual: true,
    logMetrics: true,
    logLevel: 'warn'
});

/**
 * Quality scoring thresholds for different metrics
 */
const QUALITY_THRESHOLDS = Object.freeze({
    lengthRatio: { low: 0.3, high: 0.5 },
    wordCount: { low: 20, high: 50 },
    garbageCheckLength: 500
});

/**
 * Validate and normalize OCR quality options
 * @param {Object} options - User-provided options
 * @returns {Object} Validated and normalized options
 */
function validateQualityOptions(options = {}) {
    const { normalizeBoolean } = require('./normalizers');

    const minQuality = Number.isFinite(options.minQuality)
        ? Math.max(0, Math.min(1, options.minQuality))
        : (config.visualOCR?.minQuality || DEFAULT_QUALITY_OPTIONS.minQuality);

    const preferVisual = normalizeBoolean(
        options.preferVisual,
        DEFAULT_QUALITY_OPTIONS.preferVisual
    );

    const logMetrics = normalizeBoolean(
        options.logMetrics,
        DEFAULT_QUALITY_OPTIONS.logMetrics
    );

    const logLevel = ['debug', 'info', 'warn', 'error'].includes(options.logLevel)
        ? options.logLevel
        : DEFAULT_QUALITY_OPTIONS.logLevel;

    const fallbackStrategy = ['paperless', 'visual', 'longer'].includes(options.fallbackStrategy)
        ? options.fallbackStrategy
        : 'paperless';

    return {
        minQuality,
        preferVisual,
        logMetrics,
        logLevel,
        fallbackStrategy
    };
}

/**
 * Calculate detailed quality metrics for OCR text
 * @param {string} visualText - Text from visual OCR
 * @param {string} paperlessText - Text from Paperless OCR
 * @returns {Object} Detailed metrics object
 */
function calculateDetailedMetrics(visualText, paperlessText) {
    if (!visualText || visualText.length === 0) {
        return {
            visualText: '',
            paperlessText: paperlessText || '',
            metrics: {
                lengthRatio: 0,
                wordCount: 0,
                hasStructure: false,
                noGarbage: false,
                hasAlphanumeric: false
            },
            details: {
                visualLength: 0,
                paperlessLength: paperlessText?.length || 0,
                wordCountDetails: { visual: 0, paperless: 0 }
            }
        };
    }

    const visualWords = (visualText.match(/\s+/g) || []).length + 1;
    const paperlessWords = ((paperlessText || '').match(/\s+/g) || []).length + 1;

    return {
        visualText,
        paperlessText: paperlessText || '',
        metrics: {
            lengthRatio: visualText.length / Math.max((paperlessText || '').length, 1),
            wordCount: visualWords,
            hasStructure: /\n.*\n/.test(visualText),
            noGarbage: !/[^\x20-\x7E\n\r\t\xC0-\xFF]/.test(
                visualText.substring(0, QUALITY_THRESHOLDS.garbageCheckLength)
            ),
            hasAlphanumeric: /[a-zA-Z0-9]/.test(visualText)
        },
        details: {
            visualLength: visualText.length,
            paperlessLength: (paperlessText || '').length,
            wordCountDetails: { visual: visualWords, paperless: paperlessWords }
        }
    };
}

/**
 * Score OCR quality using semantic metrics
 *
 * Evaluates OCR text quality based on:
 * - Length ratio (30%): Visual should capture reasonable portion
 * - Word count (30%): Should have meaningful content
 * - Structure (20%): Line breaks indicate preserved layout
 * - Character quality (20%): No garbage characters + has alphanumeric
 *
 * @param {string} visualText - Text from visual OCR
 * @param {string} paperlessText - Text from Paperless
 * @param {Object} options - Scoring options
 * @param {boolean} options.logMetrics - Log detailed metrics
 * @returns {Object} Quality score and detailed metrics
 */
function scoreOcrQuality(visualText, paperlessText, options = {}) {
    const detailedMetrics = calculateDetailedMetrics(visualText, paperlessText);

    if (!visualText || visualText.length === 0) {
        return {
            score: 0,
            passed: false,
            metrics: detailedMetrics.metrics,
            details: detailedMetrics.details,
            breakdown: {
                lengthRatio: 0,
                wordCount: 0,
                structure: 0,
                characterQuality: 0
            }
        };
    }

    const { metrics } = detailedMetrics;
    const breakdown = {
        lengthRatio: 0,
        wordCount: 0,
        structure: 0,
        characterQuality: 0
    };

    // Length ratio contribution (0.3 max)
    if (metrics.lengthRatio > QUALITY_THRESHOLDS.lengthRatio.low) {
        breakdown.lengthRatio += 0.15;
    }
    if (metrics.lengthRatio > QUALITY_THRESHOLDS.lengthRatio.high) {
        breakdown.lengthRatio += 0.15;
    }

    // Word count contribution (0.3 max)
    if (metrics.wordCount > QUALITY_THRESHOLDS.wordCount.low) {
        breakdown.wordCount += 0.15;
    }
    if (metrics.wordCount > QUALITY_THRESHOLDS.wordCount.high) {
        breakdown.wordCount += 0.15;
    }

    // Structure contribution (0.2 max)
    if (metrics.hasStructure) {
        breakdown.structure += 0.2;
    }

    // Character quality contribution (0.2 max)
    if (metrics.noGarbage) {
        breakdown.characterQuality += 0.1;
    }
    if (metrics.hasAlphanumeric) {
        breakdown.characterQuality += 0.1;
    }

    const score = Math.min(
        breakdown.lengthRatio + breakdown.wordCount + breakdown.structure + breakdown.characterQuality,
        1.0
    );

    const result = {
        score,
        passed: true,
        metrics,
        details: detailedMetrics.details,
        breakdown
    };

    if (options.logMetrics) {
        logger.debug({
            event: 'ocr_quality_scored',
            score,
            breakdown,
            metrics,
            visualLength: detailedMetrics.details.visualLength,
            paperlessLength: detailedMetrics.details.paperlessLength
        });
    }

    return result;
}

/**
 * Merge visual OCR results with Paperless OCR
 *
 * Intelligently selects between visual OCR and Paperless OCR based on quality metrics.
 * Can be configured to use different fallback strategies and quality thresholds.
 *
 * @param {string} visualOcrText - Text from visual OCR
 * @param {string} paperlessOcrText - Text from Paperless OCR
 * @param {Object} options - Merge options
 * @param {number} options.minQuality - Minimum acceptable quality (0.0-1.0, default: 0.6)
 * @param {boolean} options.preferVisual - Prefer visual if close quality (default: true)
 * @param {boolean} options.logMetrics - Log detailed metrics (default: true)
 * @param {string} options.logLevel - Log level for quality warnings (default: 'warn')
 * @param {string} options.fallbackStrategy - Strategy when quality is low:
 *                                           'paperless' (default), 'visual', 'longer'
 *
 * @returns {Promise<Object>} Merged result with source attribution and metrics
 */
async function mergeOcrResults(visualOcrText, paperlessOcrText, options = {}) {
    // Validate and normalize options
    const validatedOptions = validateQualityOptions(options);

    // Score visual OCR quality
    const qualityResult = scoreOcrQuality(
        visualOcrText,
        paperlessOcrText,
        { logMetrics: validatedOptions.logMetrics }
    );

    const { score: qualityScore, breakdown, details } = qualityResult;

    // Determine which source to use
    let selectedSource = 'visual_ocr';
    let selectedText = visualOcrText;
    let reason = 'quality_acceptable';

    if (qualityScore < validatedOptions.minQuality) {
        reason = 'quality_below_threshold';

        // Apply fallback strategy
        switch (validatedOptions.fallbackStrategy) {
            case 'visual':
                // Force use visual OCR despite low quality
                selectedSource = 'visual_ocr_forced';
                selectedText = visualOcrText;
                reason = 'quality_below_threshold_forced_visual';
                break;

            case 'longer':
                // Use whichever text is longer
                if (paperlessOcrText.length > visualOcrText.length) {
                    selectedSource = 'paperless_fallback_longer';
                    selectedText = paperlessOcrText;
                    reason = 'quality_below_threshold_using_longer';
                } else {
                    selectedSource = 'visual_ocr_longer';
                    selectedText = visualOcrText;
                    reason = 'quality_below_threshold_visual_longer';
                }
                break;

            case 'paperless':
            default:
                // Default: use paperless
                selectedSource = 'paperless_fallback';
                selectedText = paperlessOcrText;
                reason = 'quality_below_threshold_fallback';
                break;
        }

        // Log the decision
        const logFn = logger[validatedOptions.logLevel] || logger.warn;
        logFn({
            event: 'visual_ocr_quality_assessment',
            score: qualityScore,
            threshold: validatedOptions.minQuality,
            selectedSource,
            fallbackStrategy: validatedOptions.fallbackStrategy,
            breakdown,
            visualLength: details.visualLength,
            paperlessLength: details.paperlessLength
        });
    } else if (validatedOptions.logMetrics) {
        logger.debug({
            event: 'visual_ocr_quality_acceptable',
            score: qualityScore,
            threshold: validatedOptions.minQuality,
            breakdown,
            visualLength: details.visualLength,
            paperlessLength: details.paperlessLength
        });
    }

    return {
        text: selectedText,
        source: selectedSource,
        quality_score: qualityScore,
        quality_breakdown: breakdown,
        metadata: {
            reason,
            visual_length: details.visualLength,
            paperless_length: details.paperlessLength,
            min_quality_threshold: validatedOptions.minQuality,
            preferred_visual: validatedOptions.preferVisual,
            fallback_strategy: validatedOptions.fallbackStrategy,
            word_count_visual: details.wordCountDetails.visual,
            word_count_paperless: details.wordCountDetails.paperless,
            passed_quality_check: qualityScore >= validatedOptions.minQuality
        }
    };
}

module.exports = {
    DEFAULT_QUALITY_OPTIONS,
    QUALITY_THRESHOLDS,
    validateQualityOptions,
    calculateDetailedMetrics,
    scoreOcrQuality,
    mergeOcrResults
};
