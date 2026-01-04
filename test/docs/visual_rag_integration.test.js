/* eslint-env mocha */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('docs: Visual RAG Integration', function () {
  it('VISUAL_RAG_INTEGRATION.md mentions ColQwen3 and 320-d embeddings and troubleshooting', function () {
    const docPath = path.join(process.cwd(), 'docs', 'VISUAL_RAG_INTEGRATION.md');
    assert.ok(fs.existsSync(docPath), 'VISUAL_RAG_INTEGRATION.md must exist');
    const content = fs.readFileSync(docPath, 'utf8');

    assert.ok(content.includes('ColQwen3') || content.includes('Tomoro'), 'Missing ColQwen3 / Tomoro reference');
    assert.ok(content.includes('320') || content.includes('320-d'), 'Missing 320-d embedding spec');
    assert.ok(content.toLowerCase().includes('flash-attn') || content.toLowerCase().includes('cuda'), 'Missing flash-attn/CUDA troubleshooting mention');
  });
});
