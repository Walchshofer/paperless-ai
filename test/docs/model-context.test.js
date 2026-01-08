const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Model docs: context windows', function() {
  it('each model doc should include a token_limits context_window (not `unknown`)', function() {
    const modelDir = path.join(process.cwd(), 'docs', 'model');
    const files = fs.readdirSync(modelDir).filter(f => f.endsWith('.md'));

    const failures = [];

    files.forEach(file => {
      const full = path.join(modelDir, file);
      const content = fs.readFileSync(full, 'utf8');
      // Look for <token_limits> section and <context_window> value
      const hasTokenLimits = /<token_limits>[\s\S]*?<\/token_limits>/m.test(content);
      if (!hasTokenLimits) {
        failures.push(`${file}: missing <token_limits>`);
        return;
      }
      const m = content.match(/<context_window>([\s\S]*?)<\/context_window>/m);
      if (!m) {
        failures.push(`${file}: missing <context_window>`);
        return;
      }
      const value = m[1].trim().toLowerCase();
      // Embedding models may be N/A; allow 'n/a' and numeric values >0
      if (value === 'unknown') {
        failures.push(`${file}: context_window is 'unknown' (please verify vendor docs and update or set OLLAMA_MODEL_LIMITS_JSON)`);
        return;
      }
      if (value !== 'n/a' && isNaN(Number(value))) {
        // allow numeric with commas, e.g., 256000
        const num = Number(value.replace(/,/g, ''));
        if (!Number.isFinite(num) || num <= 0) {
          failures.push(`${file}: invalid context_window value '${m[1].trim()}'`);
        }
      }
    });

    if (failures.length) {
      assert.fail('Model doc context window issues:\n' + failures.join('\n'));
    }
  });
});
