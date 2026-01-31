/**
 * ocrMetadata.js
 *
 * OCR metadata building and custom field management.
 * Handles building OCR metadata with translations and custom field setup.
 */

const logger = require('../../logger');
const paperlessService = require('../../paperlessService');

const OCR_CUSTOM_FIELD_BASE = 'vis_ocr_text';

/**
 * Default options for OCR metadata building
 */
const DEFAULT_OCR_OPTIONS = Object.freeze({
    includeTranslations: true,
    skipEmptyText: true,
    maxTextLength: null, // No limit by default
    translationOptions: {}
});

/**
 * Validate and normalize OCR metadata options
 * @param {Object} options - User-provided options
 * @returns {Object} Validated and normalized options
 */
function validateOcrOptions(options = {}) {
    const { normalizeBoolean } = require('./normalizers');

    const includeTranslations = normalizeBoolean(
        options.includeTranslations,
        DEFAULT_OCR_OPTIONS.includeTranslations
    );

    const skipEmptyText = normalizeBoolean(
        options.skipEmptyText,
        DEFAULT_OCR_OPTIONS.skipEmptyText
    );

    const maxTextLength = Number.isFinite(options.maxTextLength)
        ? Math.max(0, options.maxTextLength)
        : DEFAULT_OCR_OPTIONS.maxTextLength;

    const translationOptions = (options.translationOptions && typeof options.translationOptions === 'object')
        ? { ...options.translationOptions }
        : DEFAULT_OCR_OPTIONS.translationOptions;

    return {
        includeTranslations,
        skipEmptyText,
        maxTextLength,
        translationOptions
    };
}

/**
 * Truncate text to maximum length if specified
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (null for no limit)
 * @returns {Object} Result with truncated text and truncation flag
 */
function truncateTextIfNeeded(text, maxLength) {
    if (!maxLength || text.length <= maxLength) {
        return { text, truncated: false };
    }

    const truncated = text.substring(0, maxLength);
    logger.warn({
        event: 'ocr_text_truncated',
        originalLength: text.length,
        truncatedLength: maxLength,
        charactersRemoved: text.length - maxLength
    });

    return { text: truncated, truncated: true };
}

/**
 * Build OCR metadata with translations
 *
 * Processes OCR text and generates translations in German (de) and English (en).
 * Can be configured to skip translations, limit text length, or skip empty text.
 *
 * @param {string} text - OCR text to process
 * @param {string} languageHint - Language hint for source text
 * @param {Object} translator - Translation service instance
 * @param {Object} options - Options for building metadata
 * @param {boolean} options.includeTranslations - Generate translations (default: true)
 * @param {boolean} options.skipEmptyText - Skip if text is empty (default: true)
 * @param {number} options.maxTextLength - Max characters to process (null for no limit)
 * @param {Object} options.translationOptions - Options to pass to translator
 *
 * @returns {Promise<Object>} OCR metadata with translations
 * @throws {Error} If translation fails and includeTranslations is true
 */
async function buildVisOcrMetadata(text, languageHint, translator, options = {}) {
    const { normalizeLanguageHint } = require('./normalizers');

    // Validate and normalize options
    const validatedOptions = validateOcrOptions(options);

    if (!validatedOptions.includeTranslations) {
        logger.info({
            event: 'ocr_translations_disabled',
            reason: 'config'
        });
    }

    const rawText = typeof text === 'string' ? text : '';
    const sourceLang = normalizeLanguageHint(languageHint) || 'de';

    // Handle empty text based on options
    if (!rawText && validatedOptions.skipEmptyText) {
        logger.debug({
            event: 'ocr_metadata_empty_text',
            skipped: true
        });

        return {
            sourceLang,
            vis_ocr_text: '',
            vis_ocr_text_de: '',
            vis_ocr_text_en: '',
            metadata: {
                empty: true,
                translated: false
            }
        };
    }

    // Apply text truncation if configured
    const { text: processedText, truncated } = truncateTextIfNeeded(
        rawText,
        validatedOptions.maxTextLength
    );

    let visOcrDe = processedText;
    let visOcrEn = processedText;
    let translationAttempted = false;
    let translationSucceeded = false;
    const translationErrors = [];

    if (validatedOptions.includeTranslations && translator && processedText) {
        translationAttempted = true;

        try {
            if (sourceLang === 'de') {
                try {
                    visOcrEn = await translator.translate(
                        processedText,
                        'de',
                        'en',
                        validatedOptions.translationOptions
                    );
                    translationSucceeded = true;
                } catch (error) {
                    translationErrors.push({
                        direction: 'de->en',
                        error: error.message
                    });
                    logger.warn({
                        event: 'ocr_translation_failed',
                        direction: 'de->en',
                        error: error.message
                    });
                }
            } else if (sourceLang === 'en') {
                try {
                    visOcrDe = await translator.translate(
                        processedText,
                        'en',
                        'de',
                        validatedOptions.translationOptions
                    );
                    translationSucceeded = true;
                } catch (error) {
                    translationErrors.push({
                        direction: 'en->de',
                        error: error.message
                    });
                    logger.warn({
                        event: 'ocr_translation_failed',
                        direction: 'en->de',
                        error: error.message
                    });
                }
            } else {
                // Unknown language - translate to both de and en
                try {
                    visOcrDe = await translator.translate(
                        processedText,
                        sourceLang,
                        'de',
                        validatedOptions.translationOptions
                    );
                    translationSucceeded = true;
                } catch (error) {
                    translationErrors.push({
                        direction: `${sourceLang}->de`,
                        error: error.message
                    });
                    logger.warn({
                        event: 'ocr_translation_failed',
                        direction: `${sourceLang}->de`,
                        error: error.message
                    });
                }

                try {
                    visOcrEn = await translator.translate(
                        processedText,
                        sourceLang,
                        'en',
                        validatedOptions.translationOptions
                    );
                    translationSucceeded = true;
                } catch (error) {
                    translationErrors.push({
                        direction: `${sourceLang}->en`,
                        error: error.message
                    });
                    logger.warn({
                        event: 'ocr_translation_failed',
                        direction: `${sourceLang}->en`,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error({
                event: 'ocr_translation_unexpected_error',
                error: error.message
            });
            translationErrors.push({
                direction: 'unknown',
                error: error.message
            });
        }
    }

    return {
        sourceLang,
        vis_ocr_text: processedText,
        vis_ocr_text_de: visOcrDe,
        vis_ocr_text_en: visOcrEn,
        metadata: {
            empty: !processedText,
            truncated,
            originalLength: rawText.length,
            processedLength: processedText.length,
            translated: translationSucceeded,
            translationAttempted,
            translationErrors: translationErrors.length > 0 ? translationErrors : null,
            sourceLanguage: sourceLang,
            includeTranslations: validatedOptions.includeTranslations,
            maxTextLength: validatedOptions.maxTextLength
        }
    };
}

/**
 * Ensure OCR custom fields exist in Paperless
 *
 * Creates custom fields in Paperless-ngx for storing OCR text:
 * - vis_ocr_text: Base OCR text
 * - vis_ocr_text_de: German translation
 * - vis_ocr_text_en: English translation
 *
 * @returns {Promise<boolean>} Success flag
 */
async function ensureOcrCustomFields(options = {}) {
    paperlessService.initialize();
    if (!paperlessService.client) {
        logger.warn({
            event: 'ocr_custom_fields_skipped',
            reason: 'paperless_client_not_initialized'
        });
        return { success: false, fields: [], errors: [{ field: null, error: 'paperless_client_not_initialized', retryable: false }] };
    }

    const failFast = options.failFast === true ? true : (process.env.OCR_CHECKPOINT_FAIL_FAST === 'yes' || false);
    const _continueOnPartial = options.continueOnPartialSuccess === undefined
        ? true
        : !!options.continueOnPartialSuccess;

    const fields = [
        OCR_CUSTOM_FIELD_BASE,
        `${OCR_CUSTOM_FIELD_BASE}_de`,
        `${OCR_CUSTOM_FIELD_BASE}_en`
    ];

    const succeeded = [];
    const errors = [];

    for (const field of fields) {
        try {
            // Paperless-ngx uses 'string' for text fields, not 'text'
            const result = await paperlessService.createCustomFieldSafely(field, 'string');

            // Support both old-style (field object) and new structured responses
            if (result && result.id) {
                succeeded.push(field);
                logger.info({ event: 'ocr_custom_field_created', field, fieldId: result.id });
            } else if (result && result.success === false && result.error) {
                errors.push({ field, error: result.error, retryable: !!result.error.retryable });
                logger.warn({ event: 'ocr_custom_field_creation_failed', field, error: result.error });
                if (failFast) {
                    return { success: false, fields: succeeded, errors };
                }
            } else if (result && result.success === true && result.field) {
                succeeded.push(field);
                logger.info({ event: 'ocr_custom_field_created', field, fieldId: result.field.id });
            } else {
                // Unknown shape
                errors.push({ field, error: { type: 'unknown', message: 'Unknown create result' }, retryable: false });
                logger.warn({ event: 'ocr_custom_field_creation_failed_unknown', field, result });
                if (failFast) return { success: false, fields: succeeded, errors };
            }
        } catch (error) {
            // Unexpected exceptions
            const e = { type: 'exception', message: error.message || String(error), retryable: false };
            errors.push({ field, error: e, retryable: false });
            logger.error({ event: 'ocr_custom_field_creation_exception', field, error: e });
            if (failFast) return { success: false, fields: succeeded, errors };
        }
    }

    // Aggregate logging
    logger.info({
        event: 'ocr_custom_fields_ensured_summary',
        total: fields.length,
        succeeded: succeeded.length,
        failed: errors.length
    });

    const overallSuccess = errors.length === 0;
    return { success: overallSuccess, fields: succeeded, errors };
}

module.exports = {
    OCR_CUSTOM_FIELD_BASE,
    DEFAULT_OCR_OPTIONS,
    validateOcrOptions,
    truncateTextIfNeeded,
    buildVisOcrMetadata,
    ensureOcrCustomFields
};