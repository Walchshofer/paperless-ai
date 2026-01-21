const assert = require('assert');
const spawnSync = require('child_process').spawnSync;
const path = require('path');

describe('metrics startup fail-fast', function() {
  it('exits with non-zero when METRICS_INTERNAL_ONLY=true and METRICS_ALLOWED_CIDRS missing', function() {
    const env = { ...process.env, METRICS_INTERNAL_ONLY: 'true' };
    // Ensure METRICS_ALLOWED_CIDRS not set
    delete env.METRICS_ALLOWED_CIDRS;

    const res = spawnSync(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'check_metrics_config.js')], { env, timeout: 5000, encoding: 'utf8' });

    assert.notStrictEqual(res.status, 0, 'Process should exit non-zero');
    assert.match(res.stderr || res.stdout, /Startup failure: METRICS_INTERNAL_ONLY=true but METRICS_ALLOWED_CIDRS is missing or invalid/);
  });
});
