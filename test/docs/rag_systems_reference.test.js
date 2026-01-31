
const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('docs: RAG Systems Reference', function () {
  it('should exist and contain key headings', function () {
    const docPath = path.join(process.cwd(), 'docs', 'RAG_SYSTEMS_REFERENCE.md');
    assert.ok(fs.existsSync(docPath), 'RAG_SYSTEMS_REFERENCE.md must exist');
    const content = fs.readFileSync(docPath, 'utf8');
    assert.ok(content.includes('# RAG Systems Reference'), 'Missing title header');
    assert.ok(content.includes('Fallbacks & contracts'), 'Missing fallbacks section');
    assert.ok(content.includes('Telemetry & observability'), 'Missing telemetry section');
  });

  it('exists and includes authoritative references and checklist and new vision sections', function () {
    const docPath = path.join(process.cwd(), 'docs', 'RAG_SYSTEMS_REFERENCE.md');
    assert.ok(fs.existsSync(docPath), 'RAG_SYSTEMS_REFERENCE.md must exist');

    const content = fs.readFileSync(docPath, 'utf8');
    assert.ok(content.includes('## Authoritative references'), 'Missing "Authoritative references" section');
    assert.ok(content.includes('EXPERT_PIPELINE_DECISION_TABLE.md'), 'Missing link to EXPERT_PIPELINE_DECISION_TABLE.md');
    assert.ok(content.includes('PROMPT_REGISTRY_GUIDANCE_INTERACTION.md'), 'Missing link to PROMPT_REGISTRY_GUIDANCE_INTERACTION.md');
    assert.ok(content.includes('## Tests & PR checklist'), 'Missing "Tests & PR checklist" section');

    // New assertions for Ollama Visual integration and migration guidance
    assert.ok(content.includes('Ollama Visual'), 'Missing "Ollama Visual" section');
    assert.ok(content.includes('vision_extractions'), 'Missing "vision_extractions" schema proposal');
    assert.ok(content.toLowerCase().includes('re-ingest') || content.toLowerCase().includes('reingest'), 'Missing re-ingest/reingest strategy mention');

    // New assertions for sidecar embedding model upgrade
    assert.ok(content.includes('tomoro-colqwen3-embed-8b'), 'Missing reference to tomoro-colqwen3-embed-8b');
    assert.ok(content.includes('13x') || content.includes('13×') || content.toLowerCase().includes('13 times'), 'Missing "13x" storage efficiency claim');
    assert.ok(content.toLowerCase().includes('sidecar') && content.toLowerCase().includes('migration'), 'Missing sidecar migration guidance mention');
  });
});
