const fs = require('fs');
const path = require('path');
const assert = require('assert');

describe('rag page island mount + guardrails', function () {
  it('mounts islands and provides stable test ids for key controls', function () {
    // RAG UI has been retired and its functionality moved into the Unified Workspace.
    const filePath = path.join(__dirname, '..', '..', 'views', 'document-workspace.ejs');
    const source = fs.readFileSync(filePath, 'utf8');

    const requiredTokens = [
      'data-testid="document-viewer"',
      "import { mountIslands } from '/js/dist/island-runtime.js';",
      'mountIslands(document);',
    ];

    requiredTokens.forEach((token) => {
      assert.ok(source.includes(token), `missing required token: ${token}`);
    });
  });
});

