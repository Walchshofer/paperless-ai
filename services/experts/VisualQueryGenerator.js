/**
 * VisualQueryGenerator.js
 *
 * Stage 5.5: Domain-aware visual query generation.
 * Generates targeted visual search questions for missing required fields and
 * low-confidence extraction fields.
 */

const logger = require('../logger');
const { fieldMappingService } = require('./FieldMappingService');

const QueryElementType = Object.freeze({
    FIELD_EXTRACTION: 'field_extraction',
    VALIDATION: 'validation',
    EXPLORATION: 'exploration'
});

const DOMAIN_ALIASES = Object.freeze({
    financial: 'financial',
    finance: 'financial',
    medical: 'medical',
    med: 'medical',
    legal: 'legal',
    law: 'legal',
    general: 'general',
    unknown: 'general'
});

const DOMAIN_TEMPLATES = Object.freeze({
    financial: {
        invoice_number: [
            'Find the invoice number or Rechnungsnummer.',
            'Locate the invoice ID at the top of the document.',
            'Find the unique invoice reference number.'
        ],
        invoice_amount: [
            'Find the total amount or Summe Brutto.',
            'Locate the invoice total at the bottom right.',
            'Find the final payment amount including tax.'
        ],
        payment_due_date: [
            'Find the payment due date or Fälligkeitsdatum.',
            'Locate when payment is due.',
            'Find the deadline for payment.'
        ]
    },
    medical: {
        patient_name: [
            'Find the patient name.',
            'Locate the patient full name at the top.',
            'Find who this medical report is for.'
        ],
        lab_values: [
            'Find the laboratory test results table.',
            'Locate the lab values with units.',
            'Find the test results section.'
        ],
        diagnosis: [
            'Find the diagnosis section.',
            'Locate the diagnosed condition in the report.',
            'Find the primary diagnosis text.'
        ]
    },
    legal: {
        contract_parties: [
            'Find the contract parties.',
            'Locate who signed or is listed as party in this contract.',
            'Find the named legal entities in the agreement.'
        ],
        contract_start_date: [
            'Find the contract start date.',
            'Locate the effective date of the agreement.',
            'Find when this legal contract begins.'
        ],
        case_number: [
            'Find the case number or Aktenzeichen.',
            'Locate the legal reference number.',
            'Find the docket identifier in this document.'
        ]
    },
    general: {
        title: [
            'Find the document title.',
            'Locate the title or heading near the top.',
            'Find the primary heading that names this document.'
        ],
        correspondent: [
            'Find the sender or correspondent name.',
            'Locate the document originator information.',
            'Find who sent or issued this document.'
        ],
        document_date: [
            'Find the primary document date.',
            'Locate the date in the header area.',
            'Find when this document was issued.'
        ]
    }
});

const DEFAULT_CONFIG = {
    minQueriesPerDocument: 3,
    confidenceThreshold: 0.7,
    defaultPriority: 0.5,
    requiredFieldWeight: 1.5,
    optionalFieldWeight: 1.0,
    fallbackFieldSet: [
        'invoice_number',
        'invoice_amount',
        'document_date',
        'title',
        'correspondent'
    ]
};

class VisualQueryGenerator {
    constructor(options = {}) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...options
        };

        this.fieldMappingService = options.fieldMappingService ||
            fieldMappingService;

        this.stats = {
            totalDocumentsProcessed: 0,
            totalQueriesGenerated: 0,
            successRate: 0,
            averageQueriesPerDocument: 0,
            failureCount: 0
        };
    }

    async generateQueries(
        documentIdOrParams,
        domainArg,
        extractedFieldsArg,
        metadataArg = {}
    ) {
        const startTime = Date.now();

        try {
            const input = this._normalizeInput(
                documentIdOrParams,
                domainArg,
                extractedFieldsArg,
                metadataArg
            );
            const domain = this._normalizeDomain(input.domain);
            const extractedFields = input.extractedFields;
            const extractedById = this._buildExtractedFieldMap(extractedFields);

            const resolved = this._resolveDomainFields(
                domain,
                input.fieldTaxonomy,
                extractedById
            );

            const requiredFieldIds = resolved.requiredFieldIds;
            const optionalFieldIds = resolved.optionalFieldIds;
            const allowedFieldIds = resolved.allowedFieldIds;
            const lowConfidenceFields = [];
            const missingFields = [];
            const queries = [];
            const seenTargets = new Set();

            for (const field of extractedFields) {
                const fieldId = this._fieldId(field);
                if (!fieldId || !allowedFieldIds.has(fieldId)) {
                    continue;
                }
                const confidence = this._normalizeConfidence(field.confidence, 1);
                if (confidence >= this.config.confidenceThreshold) {
                    continue;
                }

                const candidate = {
                    ...this._resolveFieldDef(fieldId, resolved.fieldDefMap),
                    fieldId,
                    type: 'low_confidence',
                    isRequired: requiredFieldIds.has(fieldId),
                    existingValue: field.value,
                    existingConfidence: confidence
                };

                lowConfidenceFields.push(fieldId);
                queries.push(
                    this._buildQuery(candidate, domain, extractedFields, input)
                );
                seenTargets.add(fieldId);
            }

            for (const fieldId of requiredFieldIds) {
                if (extractedById.has(fieldId)) {
                    continue;
                }
                const candidate = {
                    ...this._resolveFieldDef(fieldId, resolved.fieldDefMap),
                    fieldId,
                    type: 'missing',
                    isRequired: true,
                    existingValue: null,
                    existingConfidence: 0
                };

                missingFields.push(fieldId);
                if (!seenTargets.has(fieldId)) {
                    queries.push(
                        this._buildQuery(candidate, domain, extractedFields, input)
                    );
                    seenTargets.add(fieldId);
                }
            }

            const taxonomyFieldIds = this._getTaxonomyFieldIds(
                input.fieldTaxonomy
            );
            for (const fieldId of taxonomyFieldIds) {
                if (extractedById.has(fieldId) || seenTargets.has(fieldId)) {
                    continue;
                }

                const candidate = {
                    ...this._resolveFieldDef(fieldId, resolved.fieldDefMap),
                    fieldId,
                    type: 'missing',
                    isRequired: requiredFieldIds.has(fieldId),
                    existingValue: null,
                    existingConfidence: 0
                };

                missingFields.push(fieldId);
                queries.push(
                    this._buildQuery(candidate, domain, extractedFields, input)
                );
                seenTargets.add(fieldId);
            }

            const fallbackCandidates = [
                ...optionalFieldIds,
                ...this.config.fallbackFieldSet
            ];

            for (const fieldId of fallbackCandidates) {
                if (queries.length >= this.config.minQueriesPerDocument) {
                    break;
                }
                if (!allowedFieldIds.has(fieldId)) {
                    continue;
                }
                if (seenTargets.has(fieldId)) {
                    continue;
                }

                const candidate = {
                    ...this._resolveFieldDef(fieldId, resolved.fieldDefMap),
                    fieldId,
                    type: 'exploration',
                    isRequired: requiredFieldIds.has(fieldId),
                    existingValue: extractedById.get(fieldId)?.value || null,
                    existingConfidence: this._normalizeConfidence(
                        extractedById.get(fieldId)?.confidence,
                        0
                    )
                };

                queries.push(
                    this._buildQuery(candidate, domain, extractedFields, input)
                );
                seenTargets.add(fieldId);
            }

            const finalQueries = this._ensureMinimumQueries(
                queries,
                Array.from(allowedFieldIds),
                domain,
                extractedFields,
                input
            );

            const metadata = this._buildMetadata(
                finalQueries,
                missingFields,
                lowConfidenceFields,
                domain,
                startTime
            );

            this._updateStats(true, finalQueries.length);

            logger.info({
                event: 'visual_query_generation_stats',
                documentId: input.documentMetadata.id ||
                    input.documentMetadata.filename,
                domain,
                totalQueries: finalQueries.length,
                missingFieldCount: missingFields.length,
                lowConfidenceFieldCount: lowConfidenceFields.length,
                generationDurationMs: metadata.generation_duration_ms
            });

            return {
                visual_queries: finalQueries,
                generation_metadata: metadata
            };
        } catch (error) {
            this._updateStats(false, 0);

            logger.error({
                event: 'visual_query_generation_failed',
                error: error.message,
                stack: error.stack
            });

            return {
                visual_queries: [],
                generation_metadata: {
                    total_queries_generated: 0,
                    success_rate: 0,
                    fields_targeted: [],
                    missing_fields: [],
                    low_confidence_fields: [],
                    error: error.message,
                    fallback: true
                }
            };
        }
    }

    _normalizeInput(
        documentIdOrParams,
        domainArg,
        extractedFieldsArg,
        metadataArg
    ) {
        if (
            documentIdOrParams &&
            typeof documentIdOrParams === 'object' &&
            (
                documentIdOrParams.extractionResults ||
                documentIdOrParams.documentMetadata ||
                documentIdOrParams.fieldTaxonomy
            )
        ) {
            const params = documentIdOrParams;
            const extractionResults = params.extractionResults || {};
            const documentMetadata = params.documentMetadata || {};
            const derivedDomain = documentMetadata.documentDomain ||
                documentMetadata.documentType ||
                params.domain ||
                'general';

            return {
                documentId: documentMetadata.id || documentMetadata.filename,
                domain: derivedDomain,
                extractedFields: Array.isArray(extractionResults.fields) ?
                    extractionResults.fields : [],
                fieldTaxonomy: params.fieldTaxonomy || null,
                ocrResults: params.ocrResults || {},
                documentMetadata
            };
        }

        const metadata = metadataArg || {};
        return {
            documentId: documentIdOrParams,
            domain: domainArg || metadata.documentType || 'general',
            extractedFields: Array.isArray(extractedFieldsArg) ?
                extractedFieldsArg : [],
            fieldTaxonomy: metadata.fieldTaxonomy || null,
            ocrResults: metadata.ocrResults || {},
            documentMetadata: {
                id: documentIdOrParams,
                filename: metadata.filename,
                documentType: domainArg || metadata.documentType || 'general'
            }
        };
    }

    _normalizeDomain(domain) {
        const normalized = String(domain || 'general').toLowerCase();
        return DOMAIN_ALIASES[normalized] || 'general';
    }

    _fieldId(field) {
        if (!field || typeof field !== 'object') {
            return '';
        }
        return String(field.fieldId || field.name || field.field_target || '')
            .trim()
            .toLowerCase();
    }

    _buildExtractedFieldMap(extractedFields) {
        const index = new Map();
        for (const field of extractedFields) {
            const fieldId = this._fieldId(field);
            if (!fieldId || index.has(fieldId)) {
                continue;
            }
            index.set(fieldId, field);
        }
        return index;
    }

    _resolveDomainFields(domain, fieldTaxonomy, extractedById) {
        const fieldDefMap = new Map();
        const requiredFieldIds = new Set();
        const optionalFieldIds = new Set();
        const allowedFieldIds = new Set();

        const mappingService = this.fieldMappingService;
        const useMapping = Boolean(
            mappingService &&
            typeof mappingService.getRequiredFields === 'function' &&
            mappingService.initialized
        );

        if (useMapping) {
            const required = mappingService.getRequiredFields(domain) || [];
            const optional = mappingService.getOptionalFields(domain) || [];

            for (const field of required) {
                if (!field?.fieldId) {
                    continue;
                }
                const fieldId = String(field.fieldId).toLowerCase();
                fieldDefMap.set(fieldId, field);
                requiredFieldIds.add(fieldId);
                allowedFieldIds.add(fieldId);
            }

            for (const field of optional) {
                if (!field?.fieldId) {
                    continue;
                }
                const fieldId = String(field.fieldId).toLowerCase();
                if (!fieldDefMap.has(fieldId)) {
                    fieldDefMap.set(fieldId, field);
                }
                optionalFieldIds.add(fieldId);
                allowedFieldIds.add(fieldId);
            }
        }

        const taxonomyFields = Array.isArray(fieldTaxonomy?.fields) ?
            fieldTaxonomy.fields : [];
        for (const entry of taxonomyFields) {
            const fieldId = typeof entry === 'string' ?
                entry.toLowerCase() :
                String(entry?.name || entry?.fieldId || '').toLowerCase();
            if (!fieldId) {
                continue;
            }
            if (!fieldDefMap.has(fieldId)) {
                fieldDefMap.set(fieldId, {
                    fieldId,
                    extractionPriority: this.config.defaultPriority,
                    domain
                });
            }
            allowedFieldIds.add(fieldId);
            optionalFieldIds.add(fieldId);
        }

        for (const fieldId of extractedById.keys()) {
            if (!fieldDefMap.has(fieldId)) {
                fieldDefMap.set(fieldId, {
                    fieldId,
                    extractionPriority: this.config.defaultPriority,
                    domain
                });
            }
            allowedFieldIds.add(fieldId);
        }

        if (allowedFieldIds.size === 0) {
            for (const fieldId of this.config.fallbackFieldSet) {
                const normalized = String(fieldId).toLowerCase();
                if (!fieldDefMap.has(normalized)) {
                    fieldDefMap.set(normalized, {
                        fieldId: normalized,
                        extractionPriority: this.config.defaultPriority,
                        domain
                    });
                }
                allowedFieldIds.add(normalized);
                optionalFieldIds.add(normalized);
            }
        }

        return {
            fieldDefMap,
            requiredFieldIds,
            optionalFieldIds,
            allowedFieldIds
        };
    }

    _resolveFieldDef(fieldId, fieldDefMap) {
        if (fieldDefMap.has(fieldId)) {
            return fieldDefMap.get(fieldId);
        }
        return {
            fieldId,
            extractionPriority: this.config.defaultPriority
        };
    }

    _buildQuery(field, domain, extractedFields, input) {
        const question = this._generateQueryForField(field, domain);
        const rarityBoost = this._calculateRarityFactor(field, extractedFields);
        const priority = this._calculatePriority(
            { ...field, rarityBoost },
            domain,
            extractedFields
        );
        const rarityFactor = this._resolveRarityFactor(
            field.fieldId,
            input.fieldTaxonomy,
            rarityBoost
        );

        let expectedElementType = QueryElementType.FIELD_EXTRACTION;
        let confidence = 0.35;

        if (field.type === 'low_confidence') {
            expectedElementType = QueryElementType.VALIDATION;
            confidence = this._normalizeConfidence(field.existingConfidence, 0.5);
        } else if (field.type === 'exploration') {
            expectedElementType = QueryElementType.EXPLORATION;
            confidence = 0.6;
        }

        return {
            question,
            field_target: field.fieldId,
            expected_element_type: expectedElementType,
            priority,
            confidence,
            rarity_factor: rarityFactor,
            paperlessField: field.paperlessField || null,
            visualLabels: Array.isArray(field.visualLabels) ?
                field.visualLabels : []
        };
    }

    _ensureMinimumQueries(
        queries,
        candidateFieldIds,
        domain,
        extractedFields,
        input
    ) {
        if (queries.length >= this.config.minQueriesPerDocument) {
            return queries;
        }

        const existingTargets = new Set(
            queries.map(query => query.field_target)
        );

        const fallbackPool = Array.isArray(candidateFieldIds) ?
            candidateFieldIds : [];
        let cursor = 0;

        while (
            queries.length < this.config.minQueriesPerDocument &&
            fallbackPool.length > 0 &&
            cursor < (fallbackPool.length * 2)
        ) {
            const fieldId = fallbackPool[cursor % fallbackPool.length];
            cursor += 1;

            if (existingTargets.has(fieldId)) {
                continue;
            }

            const candidate = {
                fieldId,
                type: 'exploration',
                extractionPriority: this.config.defaultPriority,
                isRequired: false
            };

            queries.push(
                this._buildQuery(candidate, domain, extractedFields, input)
            );
            existingTargets.add(fieldId);
        }

        return queries;
    }

    _resolveRarityFactor(fieldId, fieldTaxonomy, rarityBoost) {
        const frequency = Number(
            fieldTaxonomy?.fieldFrequencies?.[fieldId]
        );

        if (Number.isFinite(frequency)) {
            return this._clamp(1 - frequency);
        }

        return this._clamp((rarityBoost - 1) / 0.5);
    }

    _formatFieldName(fieldId) {
        return String(fieldId || '')
            .replace(/_/g, ' ')
            .trim();
    }

    _getTaxonomyFieldIds(fieldTaxonomy) {
        const taxonomyFields = Array.isArray(fieldTaxonomy?.fields) ?
            fieldTaxonomy.fields : [];

        return taxonomyFields
            .map(entry => {
                if (typeof entry === 'string') {
                    return entry.toLowerCase();
                }
                return String(entry?.name || entry?.fieldId || '')
                    .toLowerCase();
            })
            .filter(Boolean);
    }

    _generateQueryForField(field, domain) {
        const fieldId = this._fieldId(field);
        const formattedField = this._formatFieldName(fieldId);
        const templates = this._getDomainTemplate(domain, fieldId);
        const selected = templates[0] ||
            `Find the ${formattedField} in this document.`;
        const question = selected.replace(/\{\{field\}\}/g, formattedField);

        if (field.type === 'low_confidence') {
            const value = field.existingValue;
            if (value !== undefined && value !== null && String(value).trim()) {
                return `Verify ${formattedField}. Current extraction: ` +
                    `"${String(value).trim()}". ${question}`;
            }
            return `Verify ${formattedField}. ${question}`;
        }

        return question;
    }

    _getDomainTemplate(domain, fieldType) {
        const normalizedDomain = this._normalizeDomain(domain);
        const normalizedFieldType = String(fieldType || '').toLowerCase();
        const domainTemplates = DOMAIN_TEMPLATES[normalizedDomain] || {};

        if (domainTemplates[normalizedFieldType]) {
            return domainTemplates[normalizedFieldType];
        }

        if (normalizedFieldType.includes('date')) {
            return [
                'Find the {{field}} date in the document.',
                'Locate where {{field}} appears in the header or table.'
            ];
        }

        if (
            normalizedFieldType.includes('amount') ||
            normalizedFieldType.includes('total') ||
            normalizedFieldType.includes('value')
        ) {
            return [
                'Find the {{field}} value including nearby numeric context.',
                'Locate {{field}} near totals or amount sections.'
            ];
        }

        if (
            normalizedFieldType.includes('number') ||
            normalizedFieldType.includes('reference')
        ) {
            return [
                'Find the {{field}} identifier exactly as written.',
                'Locate {{field}} in the reference area of the document.'
            ];
        }

        return [
            'Find the {{field}} in this document.',
            'Locate the {{field}} field using visual context.'
        ];
    }

    _calculatePriority(field, domain, extractedFields = []) {
        const basePriority = Number(field.extractionPriority);
        const effectiveBase = Number.isFinite(basePriority) ?
            this._clamp(basePriority) :
            this.config.defaultPriority;

        let isRequired = Boolean(field.isRequired);
        if (!isRequired && this.fieldMappingService?.initialized) {
            const required = this.fieldMappingService.getRequiredFields(domain) || [];
            isRequired = required.some(
                requiredField => this._fieldId(requiredField) === this._fieldId(field)
            );
        }

        const domainWeight = isRequired ?
            this.config.requiredFieldWeight :
            this.config.optionalFieldWeight;

        const rarityBoost = Number(field.rarityBoost) ||
            this._calculateRarityFactor(field, extractedFields);

        return this._clamp(effectiveBase * domainWeight * rarityBoost);
    }

    _calculateRarityFactor(field, extractedFields) {
        const fieldId = this._fieldId(field);
        const extracted = Array.isArray(extractedFields) ?
            extractedFields : [];

        const extractionCount = extracted.filter(
            candidate => this._fieldId(candidate) === fieldId
        ).length;

        if (extractionCount === 0) {
            return 1.5;
        }
        if (extractionCount === 1) {
            return 1.2;
        }
        return 1.0;
    }

    _buildMetadata(
        queries,
        missingFields,
        lowConfidenceFields,
        domain,
        startTime
    ) {
        return {
            total_queries_generated: queries.length,
            success_rate: this.stats.successRate,
            fields_targeted: queries.map(query => query.field_target),
            missing_fields: missingFields,
            low_confidence_fields: lowConfidenceFields,
            domain,
            generation_duration_ms: Date.now() - startTime
        };
    }

    _normalizeConfidence(value, fallback) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return this._clamp(fallback);
        }
        return this._clamp(parsed);
    }

    _clamp(value) {
        return Math.max(0, Math.min(1, Number(value)));
    }

    _updateStats(success, queryCount) {
        this.stats.totalDocumentsProcessed += 1;

        if (success) {
            this.stats.totalQueriesGenerated += queryCount;
        } else {
            this.stats.failureCount += 1;
        }

        const successCount = (
            this.stats.totalDocumentsProcessed - this.stats.failureCount
        );
        this.stats.successRate = successCount /
            this.stats.totalDocumentsProcessed;
        this.stats.averageQueriesPerDocument =
            this.stats.totalQueriesGenerated /
            this.stats.totalDocumentsProcessed;
    }

    getStats() {
        return { ...this.stats };
    }

    resetStats() {
        this.stats = {
            totalDocumentsProcessed: 0,
            totalQueriesGenerated: 0,
            successRate: 0,
            averageQueriesPerDocument: 0,
            failureCount: 0
        };
    }
}

const visualQueryGenerator = new VisualQueryGenerator();

module.exports = {
    VisualQueryGenerator,
    visualQueryGenerator,
    QueryElementType,
    DEFAULT_CONFIG
};
