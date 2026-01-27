const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { RagPageVmSchema } = require('../../src/ui/contracts/RagPage.contract');

describe('rag page vm contract + parse gate', function () {
  it('parses a safe default vm', function () {
    const parsed = RagPageVmSchema.parse({
      documentId: null,
      original_url: null,
      page_count: 1,
      images: [],
      overlaysByImage: {},
    });

    assert.strictEqual(parsed.documentId, null);
    assert.strictEqual(parsed.page_count, 1);
  });

  it('uses a parse gate before rendering rag', function () {
    const serverPath = path.join(__dirname, '..', '..', 'server.js');
    const serverSource = fs.readFileSync(serverPath, 'utf8');

    assert.ok(
      serverSource.includes('RagPageVmSchema.parse'),
      'expected RagPageVmSchema.parse gate in server.js'
    );
    assert.ok(
      serverSource.includes("res.render('rag', { vm: parsedVm })"),
      'expected rag render to pass parsed vm'
    );
  });
});

