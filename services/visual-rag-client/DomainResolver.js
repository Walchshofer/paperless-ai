/**
 * DomainResolver.js
 *
 * Centralized domain detection service for the Council of Experts architecture.
 * Determines document domain from multiple signals with priority-based resolution.
 *
 * Architecture Reference: PROMPT-005 (Domain Resolution Service)
 *
 * Resolution Priority:
 * 1. Explicit override (user-provided)
 * 2. Classification result (from ExpertPipelineExecutor)
 * 3. Document type (from paperless-ngx)
 * 4. Tags (from paperless-ngx)
 * 5. Content keywords (OCR text analysis)
 * 6. Default: 'general'
 */

const logger = require('../logger');

/**
 * Domain type constants
 */
const DOMAIN_TYPES = Object.freeze({
    MEDICAL: 'medical',
    FINANCIAL: 'financial',
    LEGAL: 'legal',
    GENERAL: 'general'
});

/**
 * Document type to domain mapping
 */
const DOCUMENT_TYPE_MAP = Object.freeze({
    // Medical
    'lab_report': DOMAIN_TYPES.MEDICAL,
    'lab_result': DOMAIN_TYPES.MEDICAL,
    'prescription': DOMAIN_TYPES.MEDICAL,
    'referral': DOMAIN_TYPES.MEDICAL,
    'medical_record': DOMAIN_TYPES.MEDICAL,
    'clinical_note': DOMAIN_TYPES.MEDICAL,
    'discharge_summary': DOMAIN_TYPES.MEDICAL,
    'radiology_report': DOMAIN_TYPES.MEDICAL,
    'pathology_report': DOMAIN_TYPES.MEDICAL,
    'xray': DOMAIN_TYPES.MEDICAL,
    'ct_scan': DOMAIN_TYPES.MEDICAL,
    'mri': DOMAIN_TYPES.MEDICAL,
    'ultrasound': DOMAIN_TYPES.MEDICAL,

    // Financial
    'invoice': DOMAIN_TYPES.FINANCIAL,
    'receipt': DOMAIN_TYPES.FINANCIAL,
    'bill': DOMAIN_TYPES.FINANCIAL,
    'bank_statement': DOMAIN_TYPES.FINANCIAL,
    'tax_form': DOMAIN_TYPES.FINANCIAL,
    'expense_report': DOMAIN_TYPES.FINANCIAL,
    'purchase_order': DOMAIN_TYPES.FINANCIAL,
    'quote': DOMAIN_TYPES.FINANCIAL,
    'pay_stub': DOMAIN_TYPES.FINANCIAL,

    // Legal
    'contract': DOMAIN_TYPES.LEGAL,
    'agreement': DOMAIN_TYPES.LEGAL,
    'lease': DOMAIN_TYPES.LEGAL,
    'nda': DOMAIN_TYPES.LEGAL,
    'legal_letter': DOMAIN_TYPES.LEGAL,
    'court_filing': DOMAIN_TYPES.LEGAL,
    'power_of_attorney': DOMAIN_TYPES.LEGAL,
    'will': DOMAIN_TYPES.LEGAL,
    'trust': DOMAIN_TYPES.LEGAL
});

/**
 * Tag patterns for domain detection
 */
const TAG_PATTERNS = Object.freeze({
    [DOMAIN_TYPES.MEDICAL]: /\b(medical|health|lab|doctor|patient|hospital|clinic|diagnosis|medication|prescription|radiology|pathology)\b/i,
    [DOMAIN_TYPES.FINANCIAL]: /\b(invoice|financial|tax|vat|payment|bank|receipt|expense|accounting|fiscal|budget|billing)\b/i,
    [DOMAIN_TYPES.LEGAL]: /\b(legal|contract|agreement|court|attorney|lawyer|lawsuit|notary|witness|clause|liability)\b/i
});

/**
 * Content keyword patterns for domain detection
 */
const CONTENT_KEYWORDS = Object.freeze({
    [DOMAIN_TYPES.MEDICAL]: [
        'patient', 'diagnosis', 'medication', 'lab', 'blood', 'doctor',
        'mg', 'ml', 'prescription', 'treatment', 'symptoms', 'examination',
        'referral', 'medical', 'clinical', 'hospital', 'physician'
    ],
    [DOMAIN_TYPES.FINANCIAL]: [
        'invoice', 'total', 'amount', 'tax', 'vat', 'payment',
        '€', '$', 'iban', 'subtotal', 'due', 'balance', 'credit',
        'debit', 'account', 'transaction', 'receipt'
    ],
    [DOMAIN_TYPES.LEGAL]: [
        'contract', 'agreement', 'party', 'clause', 'witness', 'notary',
        'hereby', 'whereas', 'liability', 'indemnify', 'termination',
        'jurisdiction', 'governing law', 'arbitration', 'binding'
    ]
});

class DomainResolver {
    constructor(options = {}) {
        this.paperlessService = options.paperlessService || null;

        // Minimum keyword matches to trigger domain detection from content
        this.contentThreshold = options.contentThreshold || 3;

        // Cache for resolved domains
        this._cache = new Map();
        this._cacheMaxAge = options.cacheMaxAge || 300000; // 5 minutes
    }

    /**
     * Resolve domain from multiple signals
     * Priority: explicit > classification > document_type > tags > content
     *
     * @param {number} docId - Paperless document ID
     * @param {Object} options - Resolution options
     * @param {string} options.explicit - Explicit domain override
     * @param {Object} options.classificationResult - From ExpertPipelineExecutor
     * @param {string} options.documentType - Document type from paperless-ngx
     * @param {Array} options.tags - Tags from paperless-ngx
     * @param {string} options.content - OCR text content
     * @returns {Promise<string>} Resolved domain
     */
    async resolveDomain(docId, options = {}) {
        const {
            explicit,
            classificationResult,
            documentType,
            tags,
            content
        } = options;

        // 1. Check cache first
        const cacheKey = `${docId}-${explicit || ''}-${documentType || ''}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) {
            logger.debug(`[DomainResolver] Cache hit for doc ${docId}: ${cached}`);
            return cached;
        }

        let resolvedDomain = DOMAIN_TYPES.GENERAL;
        let source = 'default';

        // 2. Explicit override (highest priority)
        if (explicit) {
            const normalized = this._normalizeDomain(explicit);
            if (normalized !== DOMAIN_TYPES.GENERAL) {
                resolvedDomain = normalized;
                source = 'explicit';
                logger.debug(`[DomainResolver] Using explicit domain: ${resolvedDomain}`);
            }
        }

        // 3. From classification result (ExpertPipelineExecutor)
        if (source === 'default' && classificationResult?.domain) {
            const normalized = this._normalizeDomain(classificationResult.domain);
            if (normalized !== DOMAIN_TYPES.GENERAL) {
                resolvedDomain = normalized;
                source = 'classification';
                logger.debug(`[DomainResolver] Using classification domain: ${resolvedDomain}`);
            }
        }

        // Also check primary_domain in classification
        if (source === 'default' && classificationResult?.classification?.primary_domain) {
            const normalized = this._normalizeDomain(classificationResult.classification.primary_domain);
            if (normalized !== DOMAIN_TYPES.GENERAL) {
                resolvedDomain = normalized;
                source = 'classification';
                logger.debug(`[DomainResolver] Using classification primary_domain: ${resolvedDomain}`);
            }
        }

        // 4. From document type
        if (source === 'default' && documentType) {
            const fromType = this._domainFromDocType(documentType);
            if (fromType !== DOMAIN_TYPES.GENERAL) {
                resolvedDomain = fromType;
                source = 'document_type';
                logger.debug(`[DomainResolver] Using document type domain: ${resolvedDomain}`);
            }
        }

        // 5. From tags
        if (source === 'default' && tags && tags.length > 0) {
            const fromTags = this._domainFromTags(tags);
            if (fromTags !== DOMAIN_TYPES.GENERAL) {
                resolvedDomain = fromTags;
                source = 'tags';
                logger.debug(`[DomainResolver] Using tags domain: ${resolvedDomain}`);
            }
        }

        // 6. From content keywords
        if (source === 'default' && content && content.length > 0) {
            const fromContent = this._domainFromContent(content);
            if (fromContent !== DOMAIN_TYPES.GENERAL) {
                resolvedDomain = fromContent;
                source = 'content';
                logger.debug(`[DomainResolver] Using content domain: ${resolvedDomain}`);
            }
        }

        // Cache result
        this._setCache(cacheKey, resolvedDomain);

        logger.info(`[DomainResolver] Resolved domain for doc ${docId}: ${resolvedDomain} (source: ${source})`);

        return resolvedDomain;
    }

    /**
     * Get domain from document type
     * @param {string} docType - Document type string
     * @returns {string} Domain type
     */
    _domainFromDocType(docType) {
        if (!docType) return DOMAIN_TYPES.GENERAL;

        const normalized = docType.toLowerCase().replace(/[^a-z0-9]/g, '_');
        return DOCUMENT_TYPE_MAP[normalized] || DOMAIN_TYPES.GENERAL;
    }

    /**
     * Get domain from tags
     * @param {Array} tags - Array of tag objects or strings
     * @returns {string} Domain type
     */
    _domainFromTags(tags) {
        if (!tags || !Array.isArray(tags) || tags.length === 0) {
            return DOMAIN_TYPES.GENERAL;
        }

        // Extract tag names
        const tagNames = tags.map(t => {
            if (typeof t === 'string') return t;
            return t.name || t.label || '';
        }).filter(Boolean);

        const combinedTags = tagNames.join(' ').toLowerCase();

        // Check each domain pattern
        for (const [domain, pattern] of Object.entries(TAG_PATTERNS)) {
            if (pattern.test(combinedTags)) {
                return domain;
            }
        }

        return DOMAIN_TYPES.GENERAL;
    }

    /**
     * Get domain from content keywords
     * @param {string} content - OCR text content
     * @returns {string} Domain type
     */
    _domainFromContent(content) {
        if (!content || typeof content !== 'string') {
            return DOMAIN_TYPES.GENERAL;
        }

        const text = content.toLowerCase();
        const scores = {};

        // Count keyword matches for each domain
        for (const [domain, keywords] of Object.entries(CONTENT_KEYWORDS)) {
            scores[domain] = 0;
            for (const keyword of keywords) {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const matches = text.match(regex);
                if (matches) {
                    scores[domain] += matches.length;
                }
            }
        }

        // Find domain with highest score
        let maxScore = 0;
        let maxDomain = DOMAIN_TYPES.GENERAL;

        for (const [domain, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                maxDomain = domain;
            }
        }

        // Only return domain if above threshold
        if (maxScore < this.contentThreshold) {
            return DOMAIN_TYPES.GENERAL;
        }

        return maxDomain;
    }

    /**
     * Normalize domain string to valid domain type
     * @param {string} domain - Domain string
     * @returns {string} Normalized domain type
     */
    _normalizeDomain(domain) {
        if (!domain || typeof domain !== 'string') {
            return DOMAIN_TYPES.GENERAL;
        }

        const normalized = domain.toLowerCase().trim();

        // Check if it's a valid domain type
        for (const [key, value] of Object.entries(DOMAIN_TYPES)) {
            if (normalized === value || normalized === key.toLowerCase()) {
                return value;
            }
        }

        return DOMAIN_TYPES.GENERAL;
    }

    /**
     * Get from cache
     * @private
     */
    _getFromCache(key) {
        const entry = this._cache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > this._cacheMaxAge) {
            this._cache.delete(key);
            return null;
        }

        return entry.value;
    }

    /**
     * Set cache entry
     * @private
     */
    _setCache(key, value) {
        this._cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    /**
     * Clear cache
     */
    clearCache() {
        this._cache.clear();
    }

    /**
     * Get all valid domain types
     * @returns {Object} Domain types
     */
    getDomainTypes() {
        return { ...DOMAIN_TYPES };
    }
}

// Export singleton and class
const domainResolver = new DomainResolver();

module.exports = {
    DomainResolver,
    domainResolver,
    DOMAIN_TYPES,
    DOCUMENT_TYPE_MAP,
    TAG_PATTERNS,
    CONTENT_KEYWORDS
};
