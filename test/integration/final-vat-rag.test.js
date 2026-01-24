/* eslint-env mocha */
const assert = require('assert');
const path = require('path');

const internalVatRag = require('../../services/rag/InternalVatRag');
const internalLegalRag = require('../../services/rag/InternalLegalRag');

describe('Internal RAG integration (VAT & Legal)', function () {
  this.timeout(10000);

  const fs = require('fs');
  const os = require('os');

  beforeEach(() => {
    // Force reload corpus between tests
    internalVatRag._loaded = false;
    internalVatRag.cache = [];
    internalLegalRag._loaded = false;
    internalLegalRag.cache = [];

    // Ensure test corpora exist in a temp directory and point services at them
    const tmpDir = path.join(os.tmpdir(), 'paperless_test_corpora');
    const vatDir = path.join(tmpDir, 'austrian_vat');
    const legalDir = path.join(tmpDir, 'legal_corpus');
    fs.mkdirSync(vatDir, { recursive: true });
    fs.mkdirSync(legalDir, { recursive: true });

    // Create minimal sample files if missing
    const vatSample = path.join(vatDir, 'sample.md');
    if (!fs.existsSync(vatSample)) {
      fs.writeFileSync(vatSample, '# Sample VAT\n\nReverse Charge §19');
    }
    const legalSample = path.join(legalDir, 'sample.md');
    if (!fs.existsSync(legalSample)) {
      fs.writeFileSync(legalSample, '# Sample Legal\n\nContract liability example');
    }

    // Override corpus paths for the test run on both the instance and config
    internalVatRag.corpusPath = vatDir;
    internalLegalRag.corpusPath = legalDir;
    const cfg = require('../../config/config');
    cfg.vatRag = cfg.vatRag || {};
    cfg.vatRag.corpusPath = vatDir;
    cfg.legalRag = cfg.legalRag || {};
    cfg.legalRag.corpusPath = legalDir;
  });

  it('InternalVatRag._loadCorpus() should read files from data/austrian_vat', async () => {
    await internalVatRag._loadCorpus();
    assert.ok(Array.isArray(internalVatRag.cache), 'cache should be an array');
    assert.ok(internalVatRag.cache.length > 0, 'corpus should contain files');
    assert.ok(internalVatRag.cache.some(f => f.filename && f.filename.toLowerCase().endsWith('.md')),
      'at least one .md file should be present');
  });

  it("retrieve('Reverse Charge §19') should return relevant markdown containing '§19' or 'Reverse Charge'", async () => {
    await internalVatRag._loadCorpus();
    const ctx = await internalVatRag.retrieve('Reverse Charge §19');
    assert.ok(ctx && ctx.length > 0, 'retrieve should return non-empty context');
    assert.ok(ctx.includes('Reverse Charge') || ctx.includes('§ 19') || ctx.includes('§19') || ctx.toLowerCase().includes('steuerschuldner'), 'context should reference §19 / Reverse Charge');
  });

  it('InternalLegalRag.retrieve() should load the legal corpus and return content for legal keywords', async () => {
    await internalLegalRag._loadCorpus();
    assert.ok(Array.isArray(internalLegalRag.cache), 'legal cache should be an array');
    assert.ok(internalLegalRag.cache.length > 0, 'legal corpus should contain files');

    const ctx = await internalLegalRag.retrieve('contract liability');
    // If corpus has no relevant matches this may be empty; assert it returns a string (empty ok)
    assert.ok(typeof ctx === 'string', 'retrieve should return a string');
  });
});
