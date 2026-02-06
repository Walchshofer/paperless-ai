const { expect } = require('chai');
const { FieldSuggestionEngine } = require('../../services/experts/FieldSuggestionEngine');

describe('FieldSuggestionEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new FieldSuggestionEngine({
            maxSuggestions: 5,
            minRelevanceScore: 0.3
        });
        engine.resetMetrics();
    });

    describe('generateSuggestions', () => {
        it('should suggest missing required fields for financial domain', () => {
            const result = engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 }
                ],
                domain: 'financial',
                classificationResult: { confidence: 0.85 }
            });

            expect(result.suggestions).to.be.an('array');
            expect(result.summary.missingRequired).to.be.greaterThan(0);

            // Should suggest missing required fields: invoice_amount and document_date
            const requiredSuggestions = result.suggestions.filter(
                s => s.suggestionType === 'requiredMissing'
            );
            expect(requiredSuggestions.length).to.be.greaterThan(0);

            // Check for specific required fields
            const fieldIds = requiredSuggestions.map(s => s.fieldId);
            expect(fieldIds).to.include.members(['invoice_amount', 'document_date']);
        });

        it('should suggest related optional fields based on co-occurrence', () => {
            const result = engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 },
                    { fieldId: 'invoice_amount', value: 1000, confidence: 0.9 },
                    { fieldId: 'document_date', value: '2024-01-15', confidence: 0.9 }
                ],
                domain: 'financial',
                classificationResult: { confidence: 0.85 }
            });

            expect(result.suggestions).to.be.an('array');

            // Should suggest related fields like currency, invoice_vat, payment_due_date
            const relatedSuggestions = result.suggestions.filter(
                s => s.suggestionType === 'relatedOptional'
            );
            expect(relatedSuggestions.length).to.be.greaterThan(0);

            // Related fields should have relevance score > 0
            relatedSuggestions.forEach(suggestion => {
                expect(suggestion.relevanceScore).to.be.greaterThan(0);
            });
        });

        it('should suggest common pattern fields for domain', () => {
            const result = engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 },
                    { fieldId: 'invoice_amount', value: 1000, confidence: 0.9 },
                    { fieldId: 'document_date', value: '2024-01-15', confidence: 0.9 }
                ],
                domain: 'financial',
                classificationResult: { confidence: 0.85 }
            });

            const commonPatternSuggestions = result.suggestions.filter(
                s => s.suggestionType === 'commonPattern'
            );

            // Should have at least some common pattern suggestions
            // (currency, payment_due_date, invoice_vat are common for financial docs)
            expect(commonPatternSuggestions.length).to.be.greaterThan(0);
        });

        it('should rank suggestions by relevance', () => {
            const result = engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 }
                ],
                domain: 'financial',
                classificationResult: { confidence: 0.85 }
            });

            expect(result.suggestions).to.be.an('array');
            
            // Suggestions should be sorted by finalScore (descending)
            for (let i = 0; i < result.suggestions.length - 1; i++) {
                expect(result.suggestions[i].finalScore).to.be.at.least(
                    result.suggestions[i + 1].finalScore
                );
            }

            // Required missing fields should generally rank higher
            const firstSuggestion = result.suggestions[0];
            if (firstSuggestion.suggestionType === 'requiredMissing') {
                expect(firstSuggestion.priority).to.equal(1.0);
            }
        });

        it('should limit suggestions to maxSuggestions', () => {
            const limitedEngine = new FieldSuggestionEngine({
                maxSuggestions: 3,
                minRelevanceScore: 0.1
            });

            const result = limitedEngine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 }
                ],
                domain: 'financial',
                classificationResult: { confidence: 0.85 }
            });

            expect(result.suggestions).to.have.lengthOf.at.most(3);
        });

        it('should filter suggestions by minRelevanceScore', () => {
            const strictEngine = new FieldSuggestionEngine({
                maxSuggestions: 10,
                minRelevanceScore: 0.8
            });

            const result = strictEngine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 },
                    { fieldId: 'invoice_amount', value: 1000, confidence: 0.9 },
                    { fieldId: 'document_date', value: '2024-01-15', confidence: 0.9 }
                ],
                domain: 'financial',
                classificationResult: { confidence: 0.85 }
            });

            // All suggestions should meet the minimum relevance threshold
            result.suggestions.forEach(suggestion => {
                expect(suggestion.relevanceScore).to.be.at.least(0.8);
            });
        });

        it('should handle medical domain suggestions', () => {
            const result = engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'patient_name', value: 'John Doe', confidence: 0.9 }
                ],
                domain: 'medical',
                classificationResult: { confidence: 0.85 }
            });

            expect(result.suggestions).to.be.an('array');
            expect(result.summary.domain).to.equal('medical');

            // Should suggest missing required fields: doctor_name, report_date
            const requiredSuggestions = result.suggestions.filter(
                s => s.suggestionType === 'requiredMissing'
            );
            const fieldIds = requiredSuggestions.map(s => s.fieldId);
            expect(fieldIds).to.include.members(['doctor_name', 'report_date']);
        });

        it('should return empty result when no domain provided', () => {
            const result = engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'title', value: 'Test', confidence: 0.9 }
                ],
                domain: null
            });

            expect(result.suggestions).to.be.an('array').with.lengthOf(0);
            expect(result.summary.totalSuggestions).to.equal(0);
        });

        it('should include historical suggestions when enabled', () => {
            const result = engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 },
                    { fieldId: 'invoice_amount', value: 1000, confidence: 0.9 },
                    { fieldId: 'document_date', value: '2024-01-15', confidence: 0.9 }
                ],
                domain: 'financial',
                classificationResult: { confidence: 0.85 },
                documentContext: {
                    previousFields: ['payment_reference', 'iban']
                }
            });

            const historicalSuggestions = result.suggestions.filter(
                s => s.suggestionType === 'historical'
            );

            // Should have historical suggestions if enabled
            expect(historicalSuggestions.length).to.be.greaterThan(0);
        });

        it('should not duplicate already extracted fields', () => {
            const result = engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 },
                    { fieldId: 'invoice_amount', value: 1000, confidence: 0.9 },
                    { fieldId: 'document_date', value: '2024-01-15', confidence: 0.9 },
                    { fieldId: 'currency', value: 'EUR', confidence: 0.9 }
                ],
                domain: 'financial',
                classificationResult: { confidence: 0.85 }
            });

            const suggestedFieldIds = result.suggestions.map(s => s.fieldId);

            // Should not suggest already extracted fields
            expect(suggestedFieldIds).to.not.include('invoice_number');
            expect(suggestedFieldIds).to.not.include('invoice_amount');
            expect(suggestedFieldIds).to.not.include('document_date');
            expect(suggestedFieldIds).to.not.include('currency');
        });
    });

    describe('recordSuggestionAcceptance', () => {
        it('should track suggestion acceptance', () => {
            engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 }
                ],
                domain: 'financial'
            });

            const initialAcceptance = engine.getAcceptanceRate();
            expect(initialAcceptance).to.be.a('number');

            engine.recordSuggestionAcceptance('invoice_amount', 'requiredMissing');

            const newAcceptance = engine.getAcceptanceRate();
            expect(newAcceptance).to.be.greaterThan(initialAcceptance);
        });

        it('should calculate acceptance rate correctly', () => {
            // Generate suggestions
            engine.generateSuggestions({
                extractedFields: [{ fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 }],
                domain: 'financial'
            });

            const generated = engine.metrics.suggestionsGenerated;
            expect(generated).to.be.greaterThan(0);

            // Accept one suggestion
            engine.recordSuggestionAcceptance('invoice_amount', 'requiredMissing');

            const acceptanceRate = engine.getAcceptanceRate();
            expect(acceptanceRate).to.equal(1 / generated);
        });
    });

    describe('getAcceptanceRate', () => {
        it('should return 0 when no suggestions generated', () => {
            const rate = engine.getAcceptanceRate();
            expect(rate).to.equal(0);
        });

        it('should calculate acceptance rate', () => {
            engine.metrics.suggestionsGenerated = 10;
            engine.metrics.suggestionsAccepted = 3;

            const rate = engine.getAcceptanceRate();
            expect(rate).to.equal(0.3);
        });
    });

    describe('resetMetrics', () => {
        it('should reset all metrics to zero', () => {
            engine.generateSuggestions({
                extractedFields: [{ fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 }],
                domain: 'financial'
            });

            engine.recordSuggestionAcceptance('invoice_amount', 'requiredMissing');

            expect(engine.metrics.suggestionsGenerated).to.be.greaterThan(0);
            expect(engine.metrics.suggestionsAccepted).to.be.greaterThan(0);

            engine.resetMetrics();

            expect(engine.metrics.suggestionsGenerated).to.equal(0);
            expect(engine.metrics.suggestionsAccepted).to.equal(0);
            expect(engine.getAcceptanceRate()).to.equal(0);
        });
    });

    describe('co-occurrence patterns', () => {
        it('should boost relevance for co-occurring fields', () => {
            const result = engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'iban', value: 'DE89370400440532013000', confidence: 0.9 }
                ],
                domain: 'financial',
                classificationResult: { confidence: 0.85 }
            });

            // BIC should be suggested because it co-occurs with IBAN
            const bicSuggestion = result.suggestions.find(s => s.fieldId === 'bic');
            if (bicSuggestion) {
                expect(bicSuggestion.relevanceScore).to.be.greaterThan(0.3);
            }
        });
    });

    describe('suggestion structure', () => {
        it('should include all required fields in suggestion objects', () => {
            const result = engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 }
                ],
                domain: 'financial',
                classificationResult: { confidence: 0.85 }
            });

            expect(result.suggestions.length).to.be.greaterThan(0);

            result.suggestions.forEach(suggestion => {
                expect(suggestion).to.have.property('fieldId');
                expect(suggestion).to.have.property('fieldName');
                expect(suggestion).to.have.property('paperlessField');
                expect(suggestion).to.have.property('suggestionType');
                expect(suggestion).to.have.property('priority');
                expect(suggestion).to.have.property('relevanceScore');
                expect(suggestion).to.have.property('reason');
                expect(suggestion).to.have.property('fieldType');
                expect(suggestion).to.have.property('visualLabels');
                expect(suggestion).to.have.property('finalScore');
            });
        });
    });

    describe('metrics reporting', () => {
        it('should include metrics in result', () => {
            const result = engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 }
                ],
                domain: 'financial'
            });

            expect(result.metrics).to.be.an('object');
            expect(result.metrics).to.have.property('suggestionsGenerated');
            expect(result.metrics).to.have.property('suggestionsAccepted');
            expect(result.metrics).to.have.property('acceptanceRate');
            expect(result.metrics).to.have.property('suggestionsByType');
        });

        it('should track suggestions by type', () => {
            const result = engine.generateSuggestions({
                extractedFields: [
                    { fieldId: 'invoice_number', value: 'INV-001', confidence: 0.9 }
                ],
                domain: 'financial'
            });

            const typeMetrics = result.metrics.suggestionsByType;
            expect(typeMetrics).to.be.an('object');
            expect(typeMetrics.requiredMissing).to.be.a('number');
        });
    });
});
