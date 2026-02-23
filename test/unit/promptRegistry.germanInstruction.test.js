'use strict';
/**
 * test/unit/promptRegistry.germanInstruction.test.js
 *
 * Verifies that the German language instruction is present in exactly the
 * right domain-extraction prompts and is absent from routing / system /
 * OCR prompts where language-neutral output is required.
 *
 * Linked to task T0 — German Language Enforcement in Prompts.
 */

const assert = require('assert');

// Load the exported prompt objects directly (no singleton side-effects needed)
const {
    SYS_ROUTER_V1,
    SYS_ORCHESTRATOR_V1,
    VIS_OCR_V1,
    VIS_SIGNAL_ANALYZER_V1,
    VISUAL_QUERY_GENERATOR_V1,
    OCR_GUIDED_CROSS_VALIDATE_V1,
    LEGAL_ORCHESTRATOR_V1,
    // Domain extraction prompts — must all carry the German instruction
    MED_RADIOLOGY_V1,
    MED_DOCTOR_V1,
    MED_INTEGRATOR_V1,
    FIN_EXTRACT_V1,
    FIN_REASONER_V1,
    FIN_VAT_EXPERT_V1,
    LEGAL_EXTRACTOR_V1,
    GEN_FALLBACK_V1,
} = require('../../services/prompts/PromptRegistry');

const GERMAN_INSTRUCTION =
    'Always respond in German (Deutsch). All extracted values, labels, and text output must be in German unless the source document is in English.';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Assert that a prompt's systemPrompt contains the German instruction.
 */
function assertHasGermanInstruction(promptObj) {
    assert.ok(
        typeof promptObj.systemPrompt === 'string',
        `${promptObj.id}: systemPrompt must be a string`
    );
    assert.ok(
        promptObj.systemPrompt.includes(GERMAN_INSTRUCTION),
        `${promptObj.id}: systemPrompt must contain the German instruction.\n` +
        `Expected substring:\n  "${GERMAN_INSTRUCTION}"\n` +
        `Actual systemPrompt tail:\n  "${promptObj.systemPrompt.slice(-200)}"`
    );
}

/**
 * Assert that a prompt's systemPrompt does NOT contain the German instruction.
 */
function assertLacksGermanInstruction(promptObj) {
    assert.ok(
        typeof promptObj.systemPrompt === 'string',
        `${promptObj.id}: systemPrompt must be a string`
    );
    assert.ok(
        !promptObj.systemPrompt.includes(GERMAN_INSTRUCTION),
        `${promptObj.id}: systemPrompt must NOT contain the German instruction ` +
        `(this is a routing/system prompt that must stay language-neutral).`
    );
}

// ============================================================================
// Tests
// ============================================================================

describe('PromptRegistry — German language instruction', function () {

    // -----------------------------------------------------------------------
    // Prompts that MUST carry the German instruction
    // -----------------------------------------------------------------------
    describe('Domain extraction prompts contain German instruction', function () {
        it('MED_RADIOLOGY_V1 systemPrompt has German instruction', function () {
            assertHasGermanInstruction(MED_RADIOLOGY_V1);
        });

        it('MED_DOCTOR_V1 systemPrompt has German instruction', function () {
            assertHasGermanInstruction(MED_DOCTOR_V1);
        });

        it('MED_INTEGRATOR_V1 systemPrompt has German instruction', function () {
            assertHasGermanInstruction(MED_INTEGRATOR_V1);
        });

        it('FIN_EXTRACT_V1 systemPrompt has German instruction', function () {
            assertHasGermanInstruction(FIN_EXTRACT_V1);
        });

        it('FIN_REASONER_V1 systemPrompt has German instruction', function () {
            assertHasGermanInstruction(FIN_REASONER_V1);
        });

        it('FIN_VAT_EXPERT_V1 systemPrompt has German instruction', function () {
            assertHasGermanInstruction(FIN_VAT_EXPERT_V1);
        });

        it('LEGAL_EXTRACTOR_V1 systemPrompt has German instruction', function () {
            assertHasGermanInstruction(LEGAL_EXTRACTOR_V1);
        });

        it('GEN_FALLBACK_V1 systemPrompt has German instruction', function () {
            assertHasGermanInstruction(GEN_FALLBACK_V1);
        });
    });

    // -----------------------------------------------------------------------
    // Routing / system / OCR prompts that must NOT carry the German instruction
    // -----------------------------------------------------------------------
    describe('Routing and system prompts do NOT contain German instruction', function () {
        it('SYS_ROUTER_V1 systemPrompt is language-neutral (no German instruction)', function () {
            assertLacksGermanInstruction(SYS_ROUTER_V1);
        });

        it('SYS_ORCHESTRATOR_V1 systemPrompt is language-neutral', function () {
            assertLacksGermanInstruction(SYS_ORCHESTRATOR_V1);
        });

        it('VIS_OCR_V1 systemPrompt is language-neutral (OCR must mirror document language)', function () {
            assertLacksGermanInstruction(VIS_OCR_V1);
        });

        it('VIS_SIGNAL_ANALYZER_V1 systemPrompt is language-neutral', function () {
            assertLacksGermanInstruction(VIS_SIGNAL_ANALYZER_V1);
        });

        it('VISUAL_QUERY_GENERATOR_V1 systemPrompt is language-neutral', function () {
            assertLacksGermanInstruction(VISUAL_QUERY_GENERATOR_V1);
        });

        it('OCR_GUIDED_CROSS_VALIDATE_V1 systemPrompt is language-neutral', function () {
            assertLacksGermanInstruction(OCR_GUIDED_CROSS_VALIDATE_V1);
        });

        it('LEGAL_ORCHESTRATOR_V1 systemPrompt is language-neutral (orchestration prompt)', function () {
            assertLacksGermanInstruction(LEGAL_ORCHESTRATOR_V1);
        });
    });

    // -----------------------------------------------------------------------
    // Structural checks — instruction position
    // -----------------------------------------------------------------------
    describe('German instruction placement', function () {
        const EXTRACTION_PROMPTS = [
            MED_RADIOLOGY_V1,
            MED_DOCTOR_V1,
            MED_INTEGRATOR_V1,
            FIN_EXTRACT_V1,
            FIN_REASONER_V1,
            FIN_VAT_EXPERT_V1,
            LEGAL_EXTRACTOR_V1,
            GEN_FALLBACK_V1,
        ];

        for (const p of EXTRACTION_PROMPTS) {
            it(`${p.id}: German instruction appears before the closing <|eot_id|> tag`, function () {
                const sp = p.systemPrompt;
                const instrIdx = sp.indexOf(GERMAN_INSTRUCTION);
                const eotIdx = sp.lastIndexOf('<|eot_id|>');

                // eot_id must exist
                assert.ok(
                    eotIdx !== -1,
                    `${p.id}: systemPrompt must contain <|eot_id|> sentinel`
                );
                // instruction must appear before the last eot_id
                assert.ok(
                    instrIdx < eotIdx,
                    `${p.id}: German instruction must appear before <|eot_id|>. ` +
                    `instrIdx=${instrIdx} eotIdx=${eotIdx}`
                );
            });
        }

        it('German instruction appears exactly once per modified prompt (no duplication)', function () {
            for (const p of EXTRACTION_PROMPTS) {
                const count = p.systemPrompt.split(GERMAN_INSTRUCTION).length - 1;
                assert.strictEqual(
                    count,
                    1,
                    `${p.id}: German instruction should appear exactly once, found ${count} time(s)`
                );
            }
        });
    });
});
