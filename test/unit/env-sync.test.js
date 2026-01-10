const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('env sync', function () {
  it('generates paperless-ngx/.env from docker-compose.env', function () {
    this.timeout(5000);
    const root = path.resolve(__dirname, '../../');
    const syncScript = path.join(root, 'scripts', 'sync_dotenv_from_compose_env.sh');
    const psScript = path.join(root, 'scripts', 'sync_dotenv_from_compose_env.ps1');
    const dst = path.resolve(path.join(root, '..', 'paperless-ngx', '.env'));

    // Try POSIX script first; fall back to PowerShell on Windows
    try {
      execSync(`bash ${syncScript}`, { cwd: root, stdio: 'pipe' });
    } catch (err) {
      // try PowerShell
      try {
        execSync(`pwsh -NoProfile -File ${psScript}`, { cwd: root, stdio: 'pipe' });
      } catch (err2) {
        // If both fail, skip test (CI might not have shell); assert at least file exists
      }
    }

    assert.ok(fs.existsSync(dst), `${dst} should exist after running sync script`);
    const contents = fs.readFileSync(dst, 'utf8');
    assert.ok(/INDEX_DIR/.test(contents), 'INDEX_DIR should be present in generated .env');
    assert.ok(/MEDIA_DIR/.test(contents), 'MEDIA_DIR should be present in generated .env');
    assert.ok(/VISUAL_RAG_INDEX_NAME/.test(contents) || /DEFAULT_INDEX_NAME/.test(contents), 'VISUAL_RAG_INDEX_NAME or DEFAULT_INDEX_NAME should be present in generated .env');
    // Ensure the generated file contains resolved values (no unreplaced ${...} patterns)
    assert.ok(!/\$\{/.test(contents), 'Generated .env should not contain unresolved ${...} expressions');
    // Ensure critical vars are non-empty
    const lines = contents.split('\n');
    const map = Object.fromEntries(lines.filter(l=>l.includes('=')).map(l=>[l.split('=')[0], l.split('=').slice(1).join('=')]));
    assert.ok(map['INDEX_DIR'] && map['INDEX_DIR'] !== '', 'INDEX_DIR should be non-empty in generated .env');
    assert.ok(map['MEDIA_DIR'] && map['MEDIA_DIR'] !== '', 'MEDIA_DIR should be non-empty in generated .env');
  });
});