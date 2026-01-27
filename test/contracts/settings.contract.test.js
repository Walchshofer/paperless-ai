const tsNodeService = require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { SettingsPageVmSchema } = require('../../src/ui/contracts/Settings.contract.ts');

describe('Settings contract', function() {
  it('contract file exists', function() {
    const p = path.resolve(__dirname, '../../src/ui/contracts/Settings.contract.ts');
    assert.ok(fs.existsSync(p), 'Settings contract file should exist');
  });

  it('parses a sample settings vm payload', function() {
    const sampleVm = {
      page: 'settings',
      version: '0.0.0-test',
      settings: {
        PAPERLESS_API_URL: 'http://localhost:8000',
        AI_PROVIDER: 'openai',
        PAPERLESS_OPENAI_MODEL: 'gpt-4o-mini',
        TOKEN_LIMIT: 128000,
        TAGS: ['Invoice', 'Receipt'],
        PROMPT_TAGS: ['Invoice']
      }
    };

    // should not throw
    SettingsPageVmSchema.parse(sampleVm);
  });
});