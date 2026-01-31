const fs = require('fs');
const path = require('path');
const assert = require('assert');

describe('rag page island mount + guardrails', function () {
  it('mounts islands and provides stable test ids for key controls', function () {
    const filePath = path.join(__dirname, '..', '..', 'views', 'rag.ejs');
    const source = fs.readFileSync(filePath, 'utf8');

    const requiredTokens = [
      'data-testid="overlay-viewer-island"',
      'data-testid="rag-message-input"',
      'data-testid="rag-ai-toggle"',
      'data-testid="rag-send-button"',
      "import { mountIslands } from '/js/dist/island-runtime.js';",
      'mountIslands(document);',
    ];

    requiredTokens.forEach((token) => {
      assert.ok(source.includes(token), `missing required token: ${token}`);
    });
  });
});

