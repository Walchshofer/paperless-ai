const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const assert = require('assert');

describe('validate_env_py.py fallback acceptance', function () {
  it('uses fallback .env when docker-compose.env is missing', function () {
    this.timeout(5000);
    const root = path.resolve(__dirname, '../../');
    const envDir = path.resolve(root, '..', 'paperless-ngx');
    const src = path.join(envDir, 'docker-compose.env');
    const fallback = path.join(envDir, '.env');

    // Backup existing files if present
    let srcBak, fallbackBak;
    if (fs.existsSync(src)) {
      srcBak = src + '.bak_for_test';
      fs.renameSync(src, srcBak);
    }
    if (fs.existsSync(fallback)) {
      fallbackBak = fallback + '.bak_for_test';
      fs.renameSync(fallback, fallbackBak);
    }

    try {
      fs.mkdirSync(envDir, { recursive: true });
      const contents = [
        'INDEX_DIR=/tmp/index',
        'MEDIA_DIR=/tmp/media',
        'DEFAULT_INDEX_NAME=test_index',
      ].join('\n') + '\n';
      fs.writeFileSync(fallback, contents, 'utf8');

      const res = spawnSync('python', ['scripts/validate_env_py.py'], { cwd: root, encoding: 'utf8' });

      if (res.error) {
        // If python not available; skip the assertion but don't crash tests
        console.warn('python not available; skipping validate_env_py.py execution test', res.error);
        return;
      }

      // The script should exit 0 and print OK; also a warning should be printed to stderr
      if (res.status !== 0) {
        console.error('STDOUT:', res.stdout);
        console.error('STDERR:', res.stderr);
      }
      assert.strictEqual(res.status, 0, 'validate_env_py.py should exit 0 when fallback .env is present');
      assert.ok(/OK: required env vars present/.test(res.stdout), 'Expected OK message in stdout');
      assert.ok(/WARNING: source env file not found/.test(res.stderr), 'Expected WARNING about missing source env file in stderr');
    } finally {
      // cleanup and restore backups
      try { fs.unlinkSync(fallback); } catch (e) {}
      if (srcBak) {
        fs.renameSync(srcBak, src);
      }
      if (fallbackBak) {
        fs.renameSync(fallbackBak, fallback);
      }
    }
  });
});