#!/usr/bin/env node

const { getFallbackPromptId } = require('../services/guidance');
const { promptRegistry } = require('../services/prompts/PromptRegistry');

const fixtures = [
  {
    domain: 'medical',
    template: 'medical_classifier',
    expectedPrompt: 'MED_RADIOLOGY_V1'
  },
  {
    domain: 'financial',
    template: 'financial_extractor',
    expectedPrompt: 'FIN_EXTRACT_V1'
  },
  {
    domain: 'legal',
    template: 'legal_classifier',
    expectedPrompt: 'LEGAL_ORCHESTRATOR_V1'
  },
  {
    domain: 'general',
    template: 'general_extractor',
    expectedPrompt: 'GEN_FALLBACK_V1'
  },
  {
    domain: 'router',
    template: 'cross_pipeline_router',
    expectedPrompt: 'SYS_ROUTER_V1'
  },
  {
    domain: 'normalization',
    template: 'normalization_geometry',
    expectedPrompt: 'SYS_ROUTER_V1'
  }
];

let failures = 0;

for (const fixture of fixtures) {
  const resolvedPrompt = getFallbackPromptId(fixture.template);
  if (resolvedPrompt !== fixture.expectedPrompt) {
    console.error(
      `[FAIL] ${fixture.domain}: ${fixture.template} -> ${resolvedPrompt} (expected ${fixture.expectedPrompt})`
    );
    failures += 1;
    continue;
  }

  try {
    const prompt = promptRegistry.get(resolvedPrompt);
    if (!prompt) {
      throw new Error('Prompt not found');
    }
    console.log(
      `[OK] ${fixture.domain}: ${fixture.template} -> ${resolvedPrompt}`
    );
  } catch (error) {
    console.error(
      `[FAIL] ${fixture.domain}: ${fixture.template} -> ${resolvedPrompt} (prompt not registered)`
    );
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\n${failures} fallback mapping check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nAll fallback mappings verified.');
}
