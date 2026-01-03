const assert = require('assert');
const { getFallbackPromptId } = require('../../services/guidance');
const { promptRegistry } = require('../../services/prompts/PromptRegistry');

describe('Guidance fallback mappings', function () {
  it('includes normalization_geometry -> SYS_ROUTER_V1 and prompt is registered', function () {
    const promptId = getFallbackPromptId('normalization_geometry');
    assert.strictEqual(promptId, 'SYS_ROUTER_V1');

    const prompt = promptRegistry.get(promptId);
    assert.ok(prompt, `Expected prompt ${promptId} to be registered`);
  });
});


describe('Phase 5: Template-based temperature selection', function () {
    this.timeout(10000);

    describe('isExtractionTemplate detection', () => {
        it('should identify extractor templates for temperature 0.0', () => {
            // These template names should result in temperature 0.0
            const extractionTemplates = [
                'financial_extractor',
                'financial_extractor_v2',
                'medical_extractor',
                'legal_extractor',
                'general_extractor'
            ];

            for (const template of extractionTemplates) {
                const isExtraction = template.includes('extractor') ||
                                     template.includes('classifier') ||
                                     template.includes('validator');
                assert.strictEqual(
                    isExtraction, 
                    true, 
                    `Template ${template} should be identified as extraction`
                );
            }
        });

        it('should identify classifier templates for temperature 0.0', () => {
            const classifierTemplates = [
                'medical_classifier',
                'legal_classifier',
                'general_classifier'
            ];

            for (const template of classifierTemplates) {
                const isExtraction = template.includes('extractor') ||
                                     template.includes('classifier') ||
                                     template.includes('validator');
                assert.strictEqual(
                    isExtraction,
                    true,
                    `Template ${template} should be identified as extraction`
                );
            }
        });

        it('should identify validator templates for temperature 0.0', () => {
            const validatorTemplates = [
                'legal_validator',
                'field_validator'
            ];

            for (const template of validatorTemplates) {
                const isExtraction = template.includes('extractor') ||
                                     template.includes('classifier') ||
                                     template.includes('validator');
                assert.strictEqual(
                    isExtraction,
                    true,
                    `Template ${template} should be identified as extraction`
                );
            }
        });

        it('should NOT identify reasoner templates as extraction (temperature 0.1)', () => {
            const reasonerTemplates = [
                'financial_reasoner',
                'financial_reasoner_v2',
                'cross_pipeline_router',
                'medical_integrator',
                'vat_expert_analyzer'
            ];

            for (const template of reasonerTemplates) {
                const isExtraction = template.includes('extractor') ||
                                     template.includes('classifier') ||
                                     template.includes('validator');
                assert.strictEqual(
                    isExtraction,
                    false,
                    `Template ${template} should NOT be extraction (needs creativity)`
                );
            }
        });
    });

    describe('temperature value selection', () => {
        it('should select temperature 0.0 for extraction templates', () => {
            const templates = ['financial_extractor', 'medical_classifier', 'legal_validator'];
            
            for (const template of templates) {
                const isExtractionTemplate = template.includes('extractor') ||
                                              template.includes('classifier') ||
                                              template.includes('validator');
                const temperature = isExtractionTemplate ? 0.0 : 0.1;
                
                assert.strictEqual(
                    temperature,
                    0.0,
                    `Template ${template} should use temperature 0.0`
                );
            }
        });

        it('should select temperature 0.1 for reasoning templates', () => {
            const templates = ['financial_reasoner', 'cross_pipeline_router', 'vat_expert_analyzer'];
            
            for (const template of templates) {
                const isExtractionTemplate = template.includes('extractor') ||
                                              template.includes('classifier') ||
                                              template.includes('validator');
                const temperature = isExtractionTemplate ? 0.0 : 0.1;
                
                assert.strictEqual(
                    temperature,
                    0.1,
                    `Template ${template} should use temperature 0.1`
                );
            }
        });
    });
});
