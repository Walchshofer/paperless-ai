const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Contracts - existence and basic parse', function() {
  it('should find Zod contract files in src/ui/contracts', function() {
    const dir = path.join(__dirname, '..', '..', 'src', 'ui', 'contracts');
    const exists = fs.existsSync(dir);
    assert.ok(exists, 'contracts directory missing');
    // If contracts exist, at least one file should be present
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    assert.ok(files.length > 0, 'no contract files found');
  });
});