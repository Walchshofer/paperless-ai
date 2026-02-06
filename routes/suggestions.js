const express = require('express');
const router = express.Router();
const logger = require('../services/logger');
const { fieldSuggestionEngine } = require('../services/experts/FieldSuggestionEngine');

/**
 * GET /api/suggestions/:documentId
 *
 * Get field suggestions for a document
 *
 * Query params:
 * - domain: Document domain (financial, medical, legal, general)
 */
router.get('/:documentId', async (req, res) => {
    try {
        const { documentId } = req.params;
        const { domain, extractedFields, classificationConfidence } = req.query;

        if (!documentId) {
            return res.status(400).json({
                success: false,
                error: 'Document ID is required'
            });
        }

        if (!domain) {
            return res.status(400).json({
                success: false,
                error: 'Domain is required'
            });
        }

        // Parse extractedFields if provided as JSON string
        let parsedExtractedFields = [];
        if (extractedFields) {
            try {
                parsedExtractedFields = JSON.parse(extractedFields);
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid extractedFields JSON'
                });
            }
        }

        const result = fieldSuggestionEngine.generateSuggestions({
            extractedFields: parsedExtractedFields,
            domain,
            classificationResult: {
                confidence: parseFloat(classificationConfidence) || 0.8
            },
            documentContext: {
                documentId
            }
        });

        logger.info({
            event: 'suggestions_api_request',
            documentId,
            domain,
            totalSuggestions: result.suggestions.length
        });

        return res.json({
            success: true,
            data: result
        });

    } catch (error) {
        logger.error({
            event: 'suggestions_api_error',
            error: error.message,
            stack: error.stack
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to generate suggestions',
            details: error.message
        });
    }
});

/**
 * POST /api/suggestions/accept
 *
 * Record that a user accepted a suggestion
 *
 * Body:
 * - documentId: Document ID
 * - fieldId: Field ID that was accepted
 * - suggestionType: Type of suggestion (requiredMissing, relatedOptional, etc.)
 */
router.post('/accept', async (req, res) => {
    try {
        const { documentId, fieldId, suggestionType } = req.body;

        if (!documentId || !fieldId || !suggestionType) {
            return res.status(400).json({
                success: false,
                error: 'documentId, fieldId, and suggestionType are required'
            });
        }

        fieldSuggestionEngine.recordSuggestionAcceptance(fieldId, suggestionType);

        logger.info({
            event: 'suggestion_accepted',
            documentId,
            fieldId,
            suggestionType,
            acceptanceRate: fieldSuggestionEngine.getAcceptanceRate()
        });

        return res.json({
            success: true,
            data: {
                fieldId,
                suggestionType,
                acceptanceRate: fieldSuggestionEngine.getAcceptanceRate(),
                metrics: {
                    suggestionsGenerated: fieldSuggestionEngine.metrics.suggestionsGenerated,
                    suggestionsAccepted: fieldSuggestionEngine.metrics.suggestionsAccepted
                }
            }
        });

    } catch (error) {
        logger.error({
            event: 'suggestion_acceptance_error',
            error: error.message,
            stack: error.stack
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to record suggestion acceptance',
            details: error.message
        });
    }
});

/**
 * GET /api/suggestions/metrics
 *
 * Get suggestion engine metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const metrics = {
            suggestionsGenerated: fieldSuggestionEngine.metrics.suggestionsGenerated,
            suggestionsAccepted: fieldSuggestionEngine.metrics.suggestionsAccepted,
            acceptanceRate: fieldSuggestionEngine.getAcceptanceRate(),
            suggestionsByType: fieldSuggestionEngine.metrics.suggestionsByType
        };

        return res.json({
            success: true,
            data: metrics
        });

    } catch (error) {
        logger.error({
            event: 'suggestions_metrics_error',
            error: error.message,
            stack: error.stack
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve metrics',
            details: error.message
        });
    }
});

module.exports = router;
