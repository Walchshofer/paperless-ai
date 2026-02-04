const fs = require('fs');
const path = require('path');

const logger = require('../logger');

const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
const EXACT_MATCH_BOOST = 1.1;
const DEFAULT_EXTRACTION_PRIORITY = 0.5;

const DEFAULT_REGISTRY_PATH = path.join(
    __dirname,
    '..',
    '..',
    'config',
    'schemas',
    'fieldRegistry.json'
);

let cachedRegistry = null;
let cachedRegistryPath = null;

function loadRegistry(registryPath) {
    const resolvedPath = registryPath || DEFAULT_REGISTRY_PATH;

    if (cachedRegistry && cachedRegistryPath === resolvedPath) {
        return cachedRegistry;
    }

    const loadStart = Date.now();

    try {
        const raw = fs.readFileSync(resolvedPath, 'utf8');
        const parsed = JSON.parse(raw);
        cachedRegistry = parsed;
        cachedRegistryPath = resolvedPath;

        logger.info('[FieldMappingService] Field registry loaded', {
            fields: Object.keys(parsed.fields || {}).length,
            loadTimeMs: Date.now() - loadStart,
            registryPath: resolvedPath
        });

        return parsed;
    } catch (error) {
        cachedRegistry = null;
        cachedRegistryPath = resolvedPath;

        logger.warn('[FieldMappingService] Field registry load failed', {
            registryPath: resolvedPath,
            error: error.message
        });

        return null;
    }
}

class FieldMappingService {
    constructor(options = {}) {
        this.options = {
            similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
            registryPath: DEFAULT_REGISTRY_PATH,
            logMatches: true,
            ...options
        };

        this.fieldRegistry = {};
        this.domainMappings = {};
        this.visualLabelIndex = new Map();
        this.paperlessFieldIndex = new Map();
        this.domainFieldIndex = new Map();
        this.fieldCandidates = [];
        this._normalizedLabelCache = new Map();

        this.metrics = {
            loadTimeMs: 0,
            indexBuildTimeMs: 0
        };

        this.initialized = false;
        this.initializationError = null;

        this._initialize();
    }

    _initialize() {
        const loadStart = Date.now();
        const registry = loadRegistry(this.options.registryPath);
        this.metrics.loadTimeMs = Date.now() - loadStart;

        if (!registry || !registry.fields) {
            this.initializationError = 'field_registry_unavailable';
            this.initialized = false;

            logger.warn('[FieldMappingService] Registry unavailable', {
                registryPath: this.options.registryPath
            });

            return;
        }

        this.fieldRegistry = registry.fields || {};
        this.domainMappings = registry.domainMappings || {};

        const indexStart = Date.now();
        this._buildIndexes();
        this.metrics.indexBuildTimeMs = Date.now() - indexStart;

        this.initialized = true;
    }

    _buildIndexes() {
        this.visualLabelIndex.clear();
        this.paperlessFieldIndex.clear();
        this.domainFieldIndex.clear();
        this.fieldCandidates = [];

        for (const [fieldId, fieldDef] of Object.entries(this.fieldRegistry)) {
            if (fieldDef.paperlessField) {
                this.paperlessFieldIndex.set(fieldDef.paperlessField, fieldId);
            }

            const visualLabels = Array.isArray(fieldDef.visualLabels)
                ? fieldDef.visualLabels
                : [];

            const normalizedLabels = [];

            for (const label of visualLabels) {
                const normalized = this._normalizeLabel(label);
                if (!normalized) continue;

                normalizedLabels.push(normalized);

                const existing = this.visualLabelIndex.get(normalized) || [];
                if (!existing.includes(fieldId)) {
                    existing.push(fieldId);
                    this.visualLabelIndex.set(normalized, existing);
                }
            }

            this.fieldCandidates.push({
                fieldId,
                fieldDef,
                normalizedLabels
            });
        }

        this._buildDomainFieldIndex();
    }

    _buildDomainFieldIndex() {
        for (const [domain, mapping] of Object.entries(this.domainMappings)) {
            const fields = new Set([
                ...(mapping.requiredFields || []),
                ...(mapping.optionalFields || [])
            ]);
            this.domainFieldIndex.set(domain.toLowerCase(), fields);
        }
    }

    mapVisualToPaperless(visualLabel, domain, confidence = 0) {
        const normalizedDomain = this._normalizeDomain(domain);
        const normalizedLabel = this._normalizeLabel(visualLabel);

        if (!this.initialized || !normalizedLabel) {
            return this._noMatch(normalizedDomain, visualLabel, confidence);
        }

        const exactMatches = this.visualLabelIndex.get(normalizedLabel) || [];
        const domainMatches = this._filterByDomain(exactMatches, normalizedDomain);

        if (domainMatches.length > 0) {
            const fieldId = domainMatches[0];
            const fieldDef = this.fieldRegistry[fieldId];
            const boostedConfidence = Math.min(
                confidence * EXACT_MATCH_BOOST,
                1.0
            );

            const result = {
                fieldId,
                paperlessField: fieldDef.paperlessField,
                confidence: boostedConfidence,
                matchType: 'exact',
                domain: fieldDef.domain || normalizedDomain
            };

            this._logMatch('exact', {
                visualLabel,
                normalizedLabel,
                domain: normalizedDomain,
                fieldId,
                confidence: boostedConfidence
            });

            return result;
        }

        const fuzzyMatches = this._fuzzyMatchLabel(normalizedLabel, normalizedDomain);
        if (fuzzyMatches.length > 0) {
            const match = fuzzyMatches[0];
            const fuzzyConfidence = confidence * match.similarity;

            const result = {
                fieldId: match.fieldId,
                paperlessField: match.paperlessField,
                confidence: fuzzyConfidence,
                matchType: 'fuzzy',
                domain: match.domain
            };

            this._logMatch('fuzzy', {
                visualLabel,
                normalizedLabel,
                domain: normalizedDomain,
                fieldId: match.fieldId,
                confidence: fuzzyConfidence,
                similarity: match.similarity
            });

            return result;
        }

        this._logMatch('none', {
            visualLabel,
            normalizedLabel,
            domain: normalizedDomain,
            confidence
        });

        return this._noMatch(normalizedDomain, visualLabel, confidence);
    }

    mapPaperlessToVisual(paperlessField, domain) {
        const normalizedDomain = this._normalizeDomain(domain);

        if (!this.initialized || !paperlessField) {
            return this._emptyVisualMapping(normalizedDomain);
        }

        const fieldId = this.paperlessFieldIndex.get(paperlessField);

        if (!fieldId) {
            return this._emptyVisualMapping(normalizedDomain);
        }

        const fieldDef = this.fieldRegistry[fieldId] || {};

        return {
            fieldId,
            visualLabels: fieldDef.visualLabels || [],
            extractionPriority: fieldDef.extractionPriority || DEFAULT_EXTRACTION_PRIORITY,
            validationRules: fieldDef.validationRules || {},
            domain: fieldDef.domain || normalizedDomain,
            type: fieldDef.type,
            displayName: fieldDef.displayName || {}
        };
    }

    getAllFields(domain) {
        return [
            ...this.getRequiredFields(domain),
            ...this.getOptionalFields(domain)
        ];
    }

    getRequiredFields(domain) {
        const normalizedDomain = this._normalizeDomain(domain);
        const mapping = this.domainMappings[normalizedDomain];

        if (!mapping) {
            return [];
        }

        return (mapping.requiredFields || [])
            .map((fieldId) => this._decorateField(fieldId, true))
            .filter(Boolean);
    }

    getOptionalFields(domain) {
        const normalizedDomain = this._normalizeDomain(domain);
        const mapping = this.domainMappings[normalizedDomain];

        if (!mapping) {
            return [];
        }

        return (mapping.optionalFields || [])
            .map((fieldId) => this._decorateField(fieldId, false))
            .filter(Boolean);
    }

    validateField(fieldId, value) {
        const fieldDef = this.fieldRegistry[fieldId];
        if (!fieldDef) {
            return { valid: false, error: 'Unknown field' };
        }

        if (value === undefined || value === null) {
            return { valid: false, error: 'Value is required' };
        }

        const rules = fieldDef.validationRules || {};

        const typeError = this._validateType(fieldDef.type, value);
        if (typeError) {
            return { valid: false, error: typeError };
        }

        if (fieldDef.enum && !fieldDef.enum.includes(value)) {
            return { valid: false, error: 'Value not in enum set' };
        }

        if (rules.pattern && typeof value === 'string') {
            const regex = new RegExp(rules.pattern);
            if (!regex.test(value)) {
                return {
                    valid: false,
                    error: `Value does not match pattern: ${rules.pattern}`
                };
            }
        }

        if (typeof value === 'string') {
            if (rules.minLength !== undefined && value.length < rules.minLength) {
                return {
                    valid: false,
                    error: `Value too short (min: ${rules.minLength})`
                };
            }

            if (rules.maxLength !== undefined && value.length > rules.maxLength) {
                return {
                    valid: false,
                    error: `Value too long (max: ${rules.maxLength})`
                };
            }
        }

        if (Array.isArray(value)) {
            if (rules.minItems !== undefined && value.length < rules.minItems) {
                return {
                    valid: false,
                    error: `Too few items (min: ${rules.minItems})`
                };
            }

            if (rules.maxItems !== undefined && value.length > rules.maxItems) {
                return {
                    valid: false,
                    error: `Too many items (max: ${rules.maxItems})`
                };
            }
        }

        if (typeof value === 'number') {
            if (rules.min !== undefined && value < rules.min) {
                return {
                    valid: false,
                    error: `Value too small (min: ${rules.min})`
                };
            }

            if (rules.max !== undefined && value > rules.max) {
                return {
                    valid: false,
                    error: `Value too large (max: ${rules.max})`
                };
            }
        }

        const format = rules.format || fieldDef.format;
        if (format && typeof value === 'string') {
            if (!this._validateFormat(format, value)) {
                return { valid: false, error: `Invalid format: ${format}` };
            }
        }

        if (rules.currency && typeof value === 'string') {
            if (!/^[A-Z]{3}$/.test(value)) {
                return { valid: false, error: 'Invalid currency code' };
            }
        }

        return { valid: true };
    }

    _decorateField(fieldId, isMandatory) {
        const fieldDef = this.fieldRegistry[fieldId];
        if (!fieldDef) {
            logger.warn('[FieldMappingService] Missing field in registry', {
                fieldId
            });
            return null;
        }

        return {
            fieldId,
            ...fieldDef,
            isMandatory
        };
    }

    _validateType(type, value) {
        if (type === 'number' && (typeof value !== 'number' || Number.isNaN(value))) {
            return 'Value must be a number';
        }

        if (type === 'string' && typeof value !== 'string') {
            return 'Value must be a string';
        }

        if (type === 'array' && !Array.isArray(value)) {
            return 'Value must be an array';
        }

        return null;
    }

    _validateFormat(format, value) {
        if (format === 'date') {
            return /^\d{4}-\d{2}-\d{2}$/.test(value);
        }

        return true;
    }

    _fuzzyMatchLabel(normalizedLabel, domain) {
        if (!normalizedLabel) return [];

        const threshold = this.options.similarityThreshold;
        const allowedFields = this._getAllowedFieldIds(domain);
        const matches = [];

        for (const candidate of this.fieldCandidates) {
            if (allowedFields && !allowedFields.has(candidate.fieldId)) {
                continue;
            }

            let bestSimilarity = 0;

            for (const label of candidate.normalizedLabels) {
                const similarity = this._levenshteinSimilarity(
                    normalizedLabel,
                    label
                );
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                }
            }

            if (bestSimilarity >= threshold) {
                matches.push({
                    fieldId: candidate.fieldId,
                    paperlessField: candidate.fieldDef.paperlessField,
                    similarity: bestSimilarity,
                    domain: candidate.fieldDef.domain || domain
                });
            }
        }

        matches.sort((a, b) => b.similarity - a.similarity);

        return matches;
    }

    _levenshteinDistance(a, b) {
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;

        const matrix = Array.from({ length: a.length + 1 }, () => (
            new Array(b.length + 1).fill(0)
        ));

        for (let i = 0; i <= a.length; i += 1) {
            matrix[i][0] = i;
        }

        for (let j = 0; j <= b.length; j += 1) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= a.length; i += 1) {
            for (let j = 1; j <= b.length; j += 1) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        return matrix[a.length][b.length];
    }

    _levenshteinSimilarity(a, b) {
        const distance = this._levenshteinDistance(a, b);
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1;
        return 1 - (distance / maxLen);
    }

    _normalizeLabel(label) {
        if (label === undefined || label === null) return '';

        const raw = String(label);
        if (this._normalizedLabelCache.has(raw)) {
            return this._normalizedLabelCache.get(raw);
        }

        const normalized = raw
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '');

        this._normalizedLabelCache.set(raw, normalized);
        return normalized;
    }

    _normalizeDomain(domain) {
        if (!domain) return '';
        return String(domain).toLowerCase();
    }

    _getAllowedFieldIds(domain) {
        if (!domain) return null;
        return this.domainFieldIndex.get(domain) || null;
    }

    _filterByDomain(fieldIds, domain) {
        const allowedFields = this._getAllowedFieldIds(domain);
        if (!allowedFields) return fieldIds;
        return fieldIds.filter((fieldId) => allowedFields.has(fieldId));
    }

    _noMatch(domain, visualLabel, confidence) {
        return {
            fieldId: null,
            paperlessField: null,
            confidence: 0,
            matchType: 'none',
            domain
        };
    }

    _emptyVisualMapping(domain) {
        return {
            fieldId: null,
            visualLabels: [],
            extractionPriority: 0,
            validationRules: {},
            domain
        };
    }

    _logMatch(matchType, payload) {
        if (!this.options.logMatches) {
            return;
        }

        const meta = {
            event: 'field_mapping',
            match_type: matchType,
            ...payload
        };

        if (matchType === 'none') {
            logger.warn('[FieldMappingService] No mapping found', meta);
            return;
        }

        logger.info('[FieldMappingService] Mapping match', meta);
    }
}

const fieldMappingService = new FieldMappingService();

module.exports = {
    FieldMappingService,
    fieldMappingService
};
