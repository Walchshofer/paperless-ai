/**
 * normalizers.js
 *
 * Utility functions for normalizing and validating various input types.
 * Handles language hints, boolean values, and document structures.
 */

/**
 * Normalize language hint to standard language code
 * @param {string|null} value - Language hint value
 * @returns {string|null} Normalized language code ('de', 'en', or null)
 */
function normalizeLanguageHint(value) {
    if (!value) {
        return null;
    }
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) {
        return null;
    }
    if (normalized.startsWith('de') || normalized.includes('german') || normalized.includes('deutsch')) {
        return 'de';
    }
    if (normalized.startsWith('en') || normalized.includes('english')) {
        return 'en';
    }
    return null;
}

/**
 * Normalize boolean value with fallback
 * @param {*} value - Value to normalize
 * @param {boolean} fallback - Fallback value if indeterminate
 * @returns {boolean} Normalized boolean value
 */
function normalizeBoolean(value, fallback) {
    if (value === undefined || value === null) {
        return fallback;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', 'yes', '1'].includes(normalized)) {
            return true;
        }
        if (['false', 'no', '0'].includes(normalized)) {
            return false;
        }
    }
    return fallback;
}

/**
 * Resolve document images from various document structures
 * @param {Object} document - Document object
 * @returns {Object} Resolved image data with source attribution
 */
function resolveDocumentImages(document) {
    if (!document || typeof document !== 'object') {
        return { base64Images: [], imageData: null, source: 'none' };
    }

    const normalizedImages = (Array.isArray(document.normalized_base64Images)
        && document.normalized_base64Images.length > 0)
        ? document.normalized_base64Images
        : null;

    const base64Images = normalizedImages || document.base64Images || [];
    const imageData = normalizedImages
        ? (document.normalized_image_data || normalizedImages[0])
        : (document.image_data || base64Images[0] || null);

    return {
        base64Images,
        imageData,
        source: normalizedImages ? 'normalized' : 'original'
    };
}

module.exports = {
    normalizeLanguageHint,
    normalizeBoolean,
    resolveDocumentImages
};
