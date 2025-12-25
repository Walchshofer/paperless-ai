const assert = require('assert');
const prompts = require('../../services/prompts/MedicalPrompts');

describe('MedicalPrompts exports', function() {
    it('exports new prompts and MedicalDocumentTypes', function() {
        assert.ok(prompts.MED_IMAGING_EXTRACT_V1, 'MED_IMAGING_EXTRACT_V1 missing');
        assert.ok(prompts.MED_TEXT_EXTRACT_V1, 'MED_TEXT_EXTRACT_V1 missing');
        assert.ok(prompts.MED_INTEGRATE_V1, 'MED_INTEGRATE_V1 missing');
        assert.ok(prompts.MedicalDocumentTypes, 'MedicalDocumentTypes missing');
    });

    it('MEDICAL_PROMPTS includes the new prompt IDs', function() {
        assert.ok(prompts.MEDICAL_PROMPTS.includes('MED_IMAGING_EXTRACT_V1'));
        assert.ok(prompts.MEDICAL_PROMPTS.includes('MED_TEXT_EXTRACT_V1'));
        assert.ok(prompts.MEDICAL_PROMPTS.includes('MED_INTEGRATE_V1'));
    });

    it('registerMedicalPrompts registers the new prompts without throwing', function() {
        const registered = [];
        const fakeRegistry = { register: (p) => registered.push(p.id) };
        prompts.registerMedicalPrompts(fakeRegistry);
        assert.ok(registered.includes('MED_IMAGING_EXTRACT_V1'));
        assert.ok(registered.includes('MED_TEXT_EXTRACT_V1'));
        assert.ok(registered.includes('MED_INTEGRATE_V1'));
    });
});
