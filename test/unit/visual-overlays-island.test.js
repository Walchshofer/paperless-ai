const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('VisualOverlays Island', function() {
  it('component file exists', function() {
    const p = path.resolve(__dirname, '../../src/islands/VisualOverlaysIsland.tsx');
    assert.ok(fs.existsSync(p), 'VisualOverlaysIsland file should exist');
  });
});