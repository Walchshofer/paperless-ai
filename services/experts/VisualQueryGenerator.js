/**
 * VisualQueryGenerator.js
 *
 * Phase 3: Visual Query Generation Integration
 *
 * Generates targeted visual queries for missing or low-confidence fields
 * using the Guidance framework for structured output with logit bias.
 *
 * Architecture Reference: SSOT Retrieval Broker + Visual RAG Integration, Phase 3
 * Prerequisites: Phase 1 (CircuitBreaker), Phase 2 (Parallel OCR)
 */

const logger = require('../logger');
const { guidanceClient } = require('../guidance');

/**
 * Query element types for visual analysis
 */
const QueryElementType = Object.freeze({
    FIELD_EXTRACTION: 'field_extraction',
    VALIDATION: 'validation',
    EXPLORATION: 'exploration'
});

/**
 * Default configuration for query generation
 */
const DEFAULT_CONFIG = {
    minQueriesPerDocument: 3,
    confidenceThreshold: 0.7,        // Fields below this are considered low-confidence
    priorityWeights: {
        missingField: 1.0,            // Highest priority
        lowConfidence: 0.8,
        validation: 0.6,
        exploration: 0.4
    },
    fallbackFieldSet: [               // Used when taxonomy unavailable
        'invoice_number',
        'invoice_date',
        'total_amount',
        'vendor_name',
        'document_type'
    ]
};

/**
 * VisualQueryGenerator - Generates visual queries for document analysis
 *
 * Responsibilities:
 * 1. Analyze extraction results and identify fields needing visual confirmation
 * 2. Generate minimum 3 queries per document
 * 3. Prioritize missing fields, then low-confidence fields
 * 4. Configure logit bias for structured JSON output
 * 5. Gracefully degrade on failures (non-blocking)
 */
class VisualQueryGenerator {
    /**
     * @param {Object} options - Generator configuration
     */
    constructor(options = {}) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...options
        };

        this.stats = {
            totalDocumentsProcessed: 0,
            totalQueriesGenerated: 0,
            successRate: 0,
            averageQueriesPerDocument: 0,
            failureCount: 0
        };
    }

    /**
     * Generate visual queries for a document
     *
     * @param {Object} params - Generation parameters
     * @param {Object} params.extractionResults - Results from extraction pipeline
     * @param {Object} params.ocrResults - Reconciled OCR text from Phase 2
     * @param {Array} params.fieldTaxonomy - Custom field taxonomy (optional)
     * @param {Object} params.documentMetadata - Document metadata
     * @returns {Object} Generated queries and metadata
     */
    async generateQueries(params) {
        const {
            extractionResults = {},
            ocrResults = {},
            fieldTaxonomy = null,
            documentMetadata = {}
        } = params;

        const startTime = Date.now();

        try {
            logger.debug({
                event: 'visual_query_generation_start',
                documentId: documentMetadata.id || documentMetadata.filename
            });

            // Step 1: Analyze extraction results to identify target fields
            const fieldAnalysis = this._analyzeFields(extractionResults, fieldTaxonomy);

            // Step 2: Prioritize fields for query generation
            const prioritizedFields = this._prioritizeFields(fieldAnalysis);

            // Step 3: Generate queries for prioritized fields
            const queries = await this._generateQueriesForFields(
                prioritizedFields,
                ocrResults,
                fieldTaxonomy,
                documentMetadata
            );

            // Step 4: Ensure minimum query count
            const finalQueries = this._ensureMinimumQueries(
                queries,
                fieldAnalysis
            );

            // Step 5: Build metadata
            const metadata = this._buildMetadata(fieldAnalysis, finalQueries, startTime);

            // Update stats
            this._updateStats(true, finalQueries.length);

            logger.info({
                event: 'visual_query_generation_success',
                documentId: documentMetadata.id || documentMetadata.filename,
                queriesGenerated: finalQueries.length,
                durationMs: Date.now() - startTime
            });

            return {
                visual_queries: finalQueries,
                generation_metadata: metadata
            };

        } catch (error) {
            logger.error({
                event: 'visual_query_generation_failed',
                error: error.message,
                stack: error.stack,
                documentId: documentMetadata.id || documentMetadata.filename
            });

            // Graceful degradation: return empty queries
            this._updateStats(false, 0);

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

    /**
     * Analyze extraction results to identify fields needing visual queries
     * @private
     */
    _analyzeFields(extractionResults, fieldTaxonomy) {
        const analysis = {
            missingFields: [],
            lowConfidenceFields: [],
            extractedFields: [],
            availableFields: []
        };

        // Get available fields from taxonomy or use fallback
        const taxonomyFields = Array.isArray(fieldTaxonomy?.fields)
            ? fieldTaxonomy.fields
            : [];
        const extractedFieldNames = Array.isArray(extractionResults.fields)
            ? extractionResults.fields.map(field => field.name).filter(Boolean)
            : [];
        const fallbackFields = this.config.fallbackFieldSet;

        const availableFieldSet = new Set([
            ...taxonomyFields,
            ...extractedFieldNames,
            ...fallbackFields
        ]);
        analysis.availableFields = Array.from(availableFieldSet);

        // Analyze extraction results
        const extractedFieldsMap = new Map();
        if (extractionResults.fields && Array.isArray(extractionResults.fields)) {
            for (const field of extractionResults.fields) {
                if (!field?.name) {
                    continue;
                }
                extractedFieldsMap.set(field.name, field);
                analysis.extractedFields.push(field.name);

                // Check if field has low confidence
                if (field.confidence < this.config.confidenceThreshold &&
                    availableFieldSet.has(field.name)) {
                    analysis.lowConfidenceFields.push({
                        name: field.name,
                        confidence: field.confidence,
                        value: field.value
                    });
                }
            }
        }

        // Identify missing fields from taxonomy (or fallback)
        const missingCandidates = taxonomyFields.length > 0
            ? taxonomyFields
            : fallbackFields;
        for (const fieldName of missingCandidates) {
            if (!extractedFieldsMap.has(fieldName)) {
                analysis.missingFields.push({
                    name: fieldName,
                    rarity: this._calculateRarity(fieldName, fieldTaxonomy)
                });
            }
        }

        logger.debug({
            event: 'field_analysis_complete',
            missingCount: analysis.missingFields.length,
            lowConfidenceCount: analysis.lowConfidenceFields.length,
            extractedCount: analysis.extractedFields.length
        });

        return analysis;
    }

    /**
     * Prioritize fields for query generation
     * Missing fields first, then low-confidence fields
     * @private
     */
    _prioritizeFields(fieldAnalysis) {
        const prioritized = [];

        // Priority 1: Missing fields
        for (const missingField of fieldAnalysis.missingFields) {
            prioritized.push({
                fieldName: missingField.name,
                type: 'missing',
                priority: this.config.priorityWeights.missingField * (1 + missingField.rarity),
                rarity: missingField.rarity,
                existingValue: null,
                existingConfidence: 0
            });
        }

        // Priority 2: Low-confidence fields
        for (const lowConfField of fieldAnalysis.lowConfidenceFields) {
            prioritized.push({
                fieldName: lowConfField.name,
                type: 'low_confidence',
                priority: this.config.priorityWeights.lowConfidence * (1 - lowConfField.confidence),
                rarity: this._calculateRarity(lowConfField.name, null),
                existingValue: lowConfField.value,
                existingConfidence: lowConfField.confidence
            });
        }

        // Sort by priority (descending)
        prioritized.sort((a, b) => b.priority - a.priority);

        logger.debug({
            event: 'fields_prioritized',
            totalFields: prioritized.length,
            topField: prioritized[0]?.fieldName
        });

        return prioritized;
    }

    /**
     * Generate queries for prioritized fields
     * @private
     */
    async _generateQueriesForFields(prioritizedFields, ocrResults, fieldTaxonomy, documentMetadata) {
        const queries = [];

        // Generate query for each prioritized field
        for (const field of prioritizedFields) {
            const query = this._createQuery(field, ocrResults, documentMetadata);
            queries.push(query);

            // Stop if we have enough queries
            if (queries.length >= this.config.minQueriesPerDocument) {
                break;
            }
        }

        return queries;
    }

    /**
     * Create a single visual query for a field
     * @private
     */
    _createQuery(field, ocrResults, documentMetadata) {
        // Determine element type based on field type
        let elementType = QueryElementType.FIELD_EXTRACTION;
        if (field.type === 'low_confidence') {
            elementType = QueryElementType.VALIDATION;
        }

        // Build natural language question
        const question = this._buildQuestion(field);

        // Calculate expected confidence (higher for missing fields)
        const expectedConfidence = field.type === 'missing' ? 0.9 : 0.8;

        // Build logit bias configuration
        const logitBias = this._buildLogitBias(field.fieldName, elementType);

        return {
            question,
            field_target: field.fieldName,
            expected_element_type: elementType,
            priority: field.priority,
            confidence: expectedConfidence,
            rarity_factor: field.rarity,
            logit_bias: logitBias
        };
    }

    /**
     * Build a natural language question for a field
     * @private
     */
    _buildQuestion(field) {
        const fieldNameReadable = field.fieldName.replace(/_/g, ' ');

        if (field.type === 'missing') {
            return `What is the ${fieldNameReadable} shown in this document?`;
        } else if (field.type === 'low_confidence') {
            return `Verify the ${fieldNameReadable} in this document. Current value: "${field.existingValue}" (confidence: ${field.existingConfidence.toFixed(2)})`;
        } else {
            return `Find the ${fieldNameReadable} in this document`;
        }
    }

    /**
     * Build logit bias configuration for structured output
     * @private
     */
    _buildLogitBias(fieldName, elementType) {
        // JSON structure tokens (using GPT2 tokenizer)
        const structureTokens = [
            '{', '}', '[', ']', ':', '"', ',', 'null', 'true', 'false'
        ];

        // Field name tokens (split on underscore and capitalize)
        const fieldTokens = fieldName.split('_').map(part =>
            part.charAt(0).toUpperCase() + part.slice(1)
        );

        return {
            structure_tokens: structureTokens,
            field_tokens: fieldTokens,
            bias_strength: 1.5  // Moderate bias (0.0 = none, 2.0 = strong)
        };
    }

    /**
     * Calculate field rarity (0.0 = common, 1.0 = rare)
     * @private
     */
    _calculateRarity(fieldName, fieldTaxonomy) {
        if (!fieldTaxonomy || !fieldTaxonomy.fieldFrequencies) {
            // Default rarity for common fields
            const commonFields = ['invoice_number', 'date', 'total', 'amount'];
            return commonFields.includes(fieldName) ? 0.1 : 0.5;
        }

        const frequency = fieldTaxonomy.fieldFrequencies[fieldName] || 0;
        return Math.max(0, Math.min(1, 1 - frequency));
    }

    /**
     * Ensure minimum query count is met
     * @private
     */
    _ensureMinimumQueries(queries, fieldAnalysis) {
        if (queries.length >= this.config.minQueriesPerDocument) {
            return queries;
        }

        // Use allowed fields to meet minimum while respecting schema/taxonomy
        const remainingCount = this.config.minQueriesPerDocument - queries.length;
        const existingTargets = new Set(queries.map(q => q.field_target));
        const candidateFields = [
            ...fieldAnalysis.missingFields.map(field => ({
                fieldName: field.name,
                type: 'missing',
                priority: this.config.priorityWeights.missingField * (1 + field.rarity),
                rarity: field.rarity,
                existingValue: null,
                existingConfidence: 0
            })),
            ...fieldAnalysis.lowConfidenceFields.map(field => ({
                fieldName: field.name,
                type: 'low_confidence',
                priority: this.config.priorityWeights.lowConfidence * (1 - field.confidence),
                rarity: this._calculateRarity(field.name, null),
                existingValue: field.value,
                existingConfidence: field.confidence
            }))
        ];

        const fallbackFields = fieldAnalysis.availableFields.map(fieldName => ({
            fieldName,
            type: 'missing',
            priority: this.config.priorityWeights.missingField,
            rarity: this._calculateRarity(fieldName, null),
            existingValue: null,
            existingConfidence: 0
        }));

        const supplemental = candidateFields.length > 0 ? candidateFields : fallbackFields;
        let cursor = 0;

        const allowDuplicates =
            existingTargets.size >= fieldAnalysis.availableFields.length;

        for (let i = 0; i < remainingCount && supplemental.length > 0; i++) {
            const entry = supplemental[cursor % supplemental.length];
            cursor += 1;
            if (!allowDuplicates && existingTargets.has(entry.fieldName)) {
                i -= 1;
                continue;
            }
            const query = this._createQuery(entry);
            queries.push(query);
            existingTargets.add(entry.fieldName);
        }

        return queries;
    }

    /**
     * Build generation metadata
     * @private
     */
    _buildMetadata(fieldAnalysis, queries, startTime) {
        return {
            total_queries_generated: queries.length,
            success_rate: this.stats.successRate,
            fields_targeted: queries.map(q => q.field_target),
            missing_fields: fieldAnalysis.missingFields.map(f => f.name),
            low_confidence_fields: fieldAnalysis.lowConfidenceFields.map(f => f.name),
            generation_duration_ms: Date.now() - startTime
        };
    }

    /**
     * Update statistics
     * @private
     */
    _updateStats(success, queryCount) {
        this.stats.totalDocumentsProcessed += 1;

        if (success) {
            this.stats.totalQueriesGenerated += queryCount;
        } else {
            this.stats.failureCount += 1;
        }

        this.stats.successRate =
            (this.stats.totalDocumentsProcessed - this.stats.failureCount) /
            this.stats.totalDocumentsProcessed;

        this.stats.averageQueriesPerDocument =
            this.stats.totalQueriesGenerated / this.stats.totalDocumentsProcessed;
    }

    /**
     * Get current statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
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

// Export singleton instance
const visualQueryGenerator = new VisualQueryGenerator();

module.exports = {
    VisualQueryGenerator,
    visualQueryGenerator,
    QueryElementType,
    DEFAULT_CONFIG
};
