const logger = require('../logger');
const { fieldMappingService } = require('./FieldMappingService');

/**
 * AI-Driven Field Suggestion Engine
 * 
 * Suggests missing fields and reduces manual entry by analyzing:
 * - Missing required fields for the document domain
 * - Related optional fields based on co-occurrence patterns
 * - Common field patterns from the field registry
 * - Historical field value context
 * 
 * @class FieldSuggestionEngine
 */
class FieldSuggestionEngine {
    constructor(options = {}) {
        this.options = {
            maxSuggestions: options.maxSuggestions || 5,
            minRelevanceScore: options.minRelevanceScore || 0.3,
            enableHistoricalPatterns: options.enableHistoricalPatterns !== false,
            ...options
        };

        // Field co-occurrence patterns (fields that commonly appear together)
        this.coOccurrencePatterns = this._buildCoOccurrencePatterns();
        
        // Metrics for telemetry
        this.metrics = {
            suggestionsGenerated: 0,
            suggestionsAccepted: 0,
            suggestionsByType: {
                requiredMissing: 0,
                relatedOptional: 0,
                commonPattern: 0,
                historical: 0
            }
        };
    }

    /**
     * Generate field suggestions for a document
     * 
     * @param {Object} params
     * @param {Array} params.extractedFields - Fields already extracted from document
     * @param {string} params.domain - Document domain (financial, medical, legal, general)
     * @param {Object} params.classificationResult - Classification result with confidence
     * @param {Object} params.documentContext - Additional document context
     * @returns {Object} Suggestions with ranking
     */
    generateSuggestions({
        extractedFields = [],
        domain,
        classificationResult = {},
        documentContext = {}
    }) {
        const startTime = Date.now();

        if (!domain) {
            logger.warn('[FieldSuggestionEngine] No domain provided for suggestions');
            return this._emptyResult();
        }

        try {
            // Build extracted field map for quick lookup
            const extractedFieldMap = this._buildExtractedFieldMap(extractedFields);

            // Get all field definitions for the domain
            const requiredFields = fieldMappingService.getRequiredFields(domain);
            const optionalFields = fieldMappingService.getOptionalFields(domain);

            // Generate suggestions by type
            const suggestions = [];

            // 1. Missing required fields (highest priority)
            const missingRequired = this._findMissingRequiredFields(
                requiredFields,
                extractedFieldMap
            );
            suggestions.push(...missingRequired);

            // 2. Related optional fields based on what's already extracted
            const relatedOptional = this._findRelatedOptionalFields(
                extractedFieldMap,
                optionalFields,
                domain
            );
            suggestions.push(...relatedOptional);

            // 3. Common pattern-based suggestions
            const commonPatterns = this._findCommonPatternFields(
                extractedFieldMap,
                optionalFields,
                domain
            );
            suggestions.push(...commonPatterns);

            // 4. Historical context suggestions (if enabled)
            if (this.options.enableHistoricalPatterns) {
                const historical = this._findHistoricalSuggestions(
                    extractedFieldMap,
                    optionalFields,
                    documentContext
                );
                suggestions.push(...historical);
            }

            // Rank and filter suggestions
            const rankedSuggestions = this._rankSuggestions(suggestions, {
                domain,
                extractedFields: extractedFieldMap,
                classificationConfidence: classificationResult.confidence || 0
            });

            // Apply filters
            const filteredSuggestions = rankedSuggestions
                .filter(s => s.relevanceScore >= this.options.minRelevanceScore)
                .slice(0, this.options.maxSuggestions);

            // Update metrics
            this.metrics.suggestionsGenerated += filteredSuggestions.length;
            filteredSuggestions.forEach(s => {
                this.metrics.suggestionsByType[s.suggestionType] = 
                    (this.metrics.suggestionsByType[s.suggestionType] || 0) + 1;
            });

            const result = {
                suggestions: filteredSuggestions,
                summary: {
                    totalSuggestions: filteredSuggestions.length,
                    missingRequired: missingRequired.length,
                    relatedOptional: relatedOptional.filter(
                        s => s.relevanceScore >= this.options.minRelevanceScore
                    ).length,
                    domain,
                    generationTimeMs: Date.now() - startTime
                },
                metrics: this._getMetrics()
            };

            logger.info('[FieldSuggestionEngine] Generated suggestions', {
                domain,
                totalSuggestions: result.suggestions.length,
                missingRequired: result.summary.missingRequired,
                timeMs: result.summary.generationTimeMs
            });

            return result;

        } catch (error) {
            logger.error('[FieldSuggestionEngine] Failed to generate suggestions', {
                error: error.message,
                domain
            });
            return this._emptyResult();
        }
    }

    /**
     * Record when a suggestion is accepted by the user
     * 
     * @param {string} fieldId - Field ID that was accepted
     * @param {string} suggestionType - Type of suggestion
     */
    recordSuggestionAcceptance(fieldId, suggestionType) {
        this.metrics.suggestionsAccepted += 1;
        
        logger.info('[FieldSuggestionEngine] Suggestion accepted', {
            fieldId,
            suggestionType,
            acceptanceRate: this.getAcceptanceRate()
        });
    }

    /**
     * Get acceptance rate metric
     * 
     * @returns {number} Acceptance rate (0-1)
     */
    getAcceptanceRate() {
        if (this.metrics.suggestionsGenerated === 0) {
            return 0;
        }
        return this.metrics.suggestionsAccepted / this.metrics.suggestionsGenerated;
    }

    /**
     * Reset metrics (useful for testing)
     */
    resetMetrics() {
        this.metrics = {
            suggestionsGenerated: 0,
            suggestionsAccepted: 0,
            suggestionsByType: {
                requiredMissing: 0,
                relatedOptional: 0,
                commonPattern: 0,
                historical: 0
            }
        };
    }

    // Private methods

    _buildExtractedFieldMap(extractedFields) {
        const map = new Map();
        
        if (Array.isArray(extractedFields)) {
            extractedFields.forEach(field => {
                const fieldId = field.fieldId || field.name || field.field_id;
                if (fieldId) {
                    map.set(fieldId, field);
                }
            });
        }
        
        return map;
    }

    _findMissingRequiredFields(requiredFields, extractedFieldMap) {
        const suggestions = [];

        requiredFields.forEach(fieldDef => {
            if (!extractedFieldMap.has(fieldDef.fieldId)) {
                suggestions.push({
                    fieldId: fieldDef.fieldId,
                    fieldName: fieldDef.displayName || fieldDef.fieldId,
                    paperlessField: fieldDef.paperlessField,
                    suggestionType: 'requiredMissing',
                    priority: 1.0,
                    relevanceScore: 0.95,
                    reason: 'Required field missing for this domain',
                    fieldType: fieldDef.type,
                    visualLabels: fieldDef.visualLabels || [],
                    extractionPriority: fieldDef.extractionPriority || 0.9
                });
            }
        });

        return suggestions;
    }

    _findRelatedOptionalFields(extractedFieldMap, optionalFields, domain) {
        const suggestions = [];
        const extractedFieldIds = Array.from(extractedFieldMap.keys());

        optionalFields.forEach(fieldDef => {
            if (extractedFieldMap.has(fieldDef.fieldId)) {
                return; // Already extracted
            }

            // Calculate relevance based on co-occurrence with extracted fields
            const relevanceScore = this._calculateCoOccurrenceRelevance(
                fieldDef.fieldId,
                extractedFieldIds,
                domain
            );

            if (relevanceScore > 0) {
                suggestions.push({
                    fieldId: fieldDef.fieldId,
                    fieldName: fieldDef.displayName || fieldDef.fieldId,
                    paperlessField: fieldDef.paperlessField,
                    suggestionType: 'relatedOptional',
                    priority: 0.7,
                    relevanceScore,
                    reason: 'Related to extracted fields',
                    fieldType: fieldDef.type,
                    visualLabels: fieldDef.visualLabels || [],
                    extractionPriority: fieldDef.extractionPriority || 0.5
                });
            }
        });

        return suggestions;
    }

    _findCommonPatternFields(extractedFieldMap, optionalFields, domain) {
        const suggestions = [];

        // Domain-specific common patterns
        const domainPatterns = {
            financial: ['currency', 'payment_due_date', 'invoice_vat'],
            medical: ['provider_name', 'insurance', 'appointment_date'],
            legal: ['deadline_date', 'termination_notice'],
            general: ['tags', 'language']
        };

        const commonForDomain = domainPatterns[domain] || [];

        optionalFields.forEach(fieldDef => {
            if (extractedFieldMap.has(fieldDef.fieldId)) {
                return; // Already extracted
            }

            if (commonForDomain.includes(fieldDef.fieldId)) {
                suggestions.push({
                    fieldId: fieldDef.fieldId,
                    fieldName: fieldDef.displayName || fieldDef.fieldId,
                    paperlessField: fieldDef.paperlessField,
                    suggestionType: 'commonPattern',
                    priority: 0.6,
                    relevanceScore: 0.5,
                    reason: 'Commonly used in this document type',
                    fieldType: fieldDef.type,
                    visualLabels: fieldDef.visualLabels || [],
                    extractionPriority: fieldDef.extractionPriority || 0.5
                });
            }
        });

        return suggestions;
    }

    _findHistoricalSuggestions(extractedFieldMap, optionalFields, documentContext) {
        const suggestions = [];

        // This is a placeholder for historical pattern analysis
        // In a real implementation, this would query a database of historical
        // extraction patterns based on document similarity

        // For now, we use document context hints if available
        if (documentContext.previousFields && Array.isArray(documentContext.previousFields)) {
            documentContext.previousFields.forEach(historicalFieldId => {
                const fieldDef = optionalFields.find(f => f.fieldId === historicalFieldId);
                
                if (fieldDef && !extractedFieldMap.has(fieldDef.fieldId)) {
                    suggestions.push({
                        fieldId: fieldDef.fieldId,
                        fieldName: fieldDef.displayName || fieldDef.fieldId,
                        paperlessField: fieldDef.paperlessField,
                        suggestionType: 'historical',
                        priority: 0.5,
                        relevanceScore: 0.4,
                        reason: 'Previously extracted from similar documents',
                        fieldType: fieldDef.type,
                        visualLabels: fieldDef.visualLabels || [],
                        extractionPriority: fieldDef.extractionPriority || 0.5
                    });
                }
            });
        }

        return suggestions;
    }

    _calculateCoOccurrenceRelevance(targetFieldId, extractedFieldIds, domain) {
        const patterns = this.coOccurrencePatterns[domain] || {};
        const relatedFields = patterns[targetFieldId] || [];

        if (relatedFields.length === 0) {
            return 0;
        }

        // Calculate overlap between extracted fields and related fields
        const overlap = extractedFieldIds.filter(id => relatedFields.includes(id)).length;
        
        if (overlap === 0) {
            return 0;
        }

        // Score based on overlap ratio and field extraction priority
        return Math.min(0.8, (overlap / relatedFields.length) * 0.8);
    }

    _rankSuggestions(suggestions, context) {
        // Calculate final score for each suggestion
        suggestions.forEach(suggestion => {
            suggestion.finalScore = this._calculateFinalScore(suggestion, context);
        });

        // Sort by final score (descending)
        suggestions.sort((a, b) => b.finalScore - a.finalScore);

        return suggestions;
    }

    _calculateFinalScore(suggestion, context) {
        // Weighted combination of factors
        const weights = {
            priority: 0.4,
            relevanceScore: 0.35,
            extractionPriority: 0.15,
            classificationConfidence: 0.1
        };

        return (
            suggestion.priority * weights.priority +
            suggestion.relevanceScore * weights.relevanceScore +
            (suggestion.extractionPriority || 0.5) * weights.extractionPriority +
            context.classificationConfidence * weights.classificationConfidence
        );
    }

    _buildCoOccurrencePatterns() {
        // Field co-occurrence patterns based on domain knowledge
        return {
            financial: {
                invoice_number: ['invoice_amount', 'currency', 'invoice_vat', 'payment_due_date'],
                invoice_amount: ['invoice_number', 'currency', 'invoice_vat', 'invoice_net'],
                payment_due_date: ['invoice_number', 'invoice_amount', 'payment_reference'],
                iban: ['bic', 'payment_reference'],
                invoice_vat: ['invoice_net', 'vat_rate', 'total_gross'],
                currency: ['invoice_amount', 'total_gross', 'total_net']
            },
            medical: {
                patient_name: ['doctor_name', 'report_date', 'provider_name'],
                doctor_name: ['patient_name', 'provider_name', 'provider_location'],
                diagnosis: ['medication', 'doctor_name', 'report_date'],
                lab_values: ['lab_panel_name', 'lab_report_date', 'doctor_name'],
                medication: ['diagnosis', 'doctor_name'],
                insurance: ['patient_name', 'provider_name']
            },
            legal: {
                contract_parties: ['contract_start_date', 'contract_end_date', 'contract_value'],
                contract_start_date: ['contract_end_date', 'termination_notice'],
                case_number: ['deadline_date', 'contract_parties'],
                deadline_date: ['case_number']
            },
            general: {
                title: ['correspondent', 'document_date'],
                correspondent: ['title', 'document_date'],
                document_date: ['title', 'correspondent']
            }
        };
    }

    _getMetrics() {
        return {
            suggestionsGenerated: this.metrics.suggestionsGenerated,
            suggestionsAccepted: this.metrics.suggestionsAccepted,
            acceptanceRate: this.getAcceptanceRate(),
            suggestionsByType: { ...this.metrics.suggestionsByType }
        };
    }

    _emptyResult() {
        return {
            suggestions: [],
            summary: {
                totalSuggestions: 0,
                missingRequired: 0,
                relatedOptional: 0,
                domain: null,
                generationTimeMs: 0
            },
            metrics: this._getMetrics()
        };
    }
}

// Singleton instance
const fieldSuggestionEngine = new FieldSuggestionEngine();

module.exports = {
    FieldSuggestionEngine,
    fieldSuggestionEngine
};
