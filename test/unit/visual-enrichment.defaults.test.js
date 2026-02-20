const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

describe('Visual enrichment defaults and presets', function () {
  it('uses visual-first defaults when env flags are unset', function () {
    const configPath = path.resolve(__dirname, '../../config/config.js');
    const script = `
      delete process.env.ENABLE_VISUAL_RAG;
      delete process.env.ENABLE_VISUAL_RAG_SIDECAR;
      const cfg = require(${JSON.stringify(configPath)});
      process.stdout.write(String(cfg.visualRag.enabled) + ',' + String(cfg.visualRagSidecar.enabled));
    `;

    const env = { ...process.env };
    delete env.ENABLE_VISUAL_RAG;
    delete env.ENABLE_VISUAL_RAG_SIDECAR;

    const result = spawnSync('node', ['-e', script], {
      encoding: 'utf8',
      env,
    });

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    const output = result.stdout.trim().split(/\r?\n/).pop();
    assert.strictEqual(output, 'yes,yes');
  });

  it('keeps built-in presets visual-first with sidecar enabled', function () {
    const presetsDir = path.resolve(__dirname, '../../config/presets');
    const presetNames = ['production', 'development', 'financial', 'legal', 'medical'];

    for (const presetName of presetNames) {
      const presetPath = path.join(presetsDir, `${presetName}.json`);
      const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
      const settings = preset.settings || {};

      assert.strictEqual(
        settings.ENABLE_VISUAL_RAG,
        'yes',
        `${presetName} preset must set ENABLE_VISUAL_RAG=yes`
      );
      assert.strictEqual(
        settings.ENABLE_VISUAL_RAG_SIDECAR,
        'yes',
        `${presetName} preset must set ENABLE_VISUAL_RAG_SIDECAR=yes`
      );
    }

    const production = JSON.parse(
      fs.readFileSync(path.join(presetsDir, 'production.json'), 'utf8')
    );
    assert.strictEqual(
      production.settings.FORCE_VISUAL_RAG,
      'no',
      'production preset should stay visual-first with explicit fallback, not forced-only mode'
    );
  });
});
