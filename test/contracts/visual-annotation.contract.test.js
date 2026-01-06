const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('VisualAnnotation contract', function() {
  it('contract file exists', function() {
    const p = path.resolve(__dirname, '../../src/ui/contracts/VisualAnnotation.contract.ts');
    assert.ok(fs.existsSync(p), 'VisualAnnotation contract file should exist');
  });
});
