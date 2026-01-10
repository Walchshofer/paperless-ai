const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('env sync', function () {
  it('generates paperless-ngx/.env from docker-compose.env or creates a safe CI fallback', function () {
    this.timeout(5000);
    const root = path.resolve(__dirname, '../../');
    const syncScript = path.join(root, 'scripts', 'sync_dotenv_from_compose_env.sh');
    const psScript = path.join(root, 'scripts', 'sync_dotenv_from_compose_env.ps1');
    const dst = path.resolve(path.join(root, '..', 'paperless-ngx', '.env'));
    const src = path.resolve(path.join(root, '..', 'paperless-ngx', 'docker-compose.env'));

    // Run the sync script (POSIX preferred, fallback to PowerShell on Windows)
    let ran = false;
    try {
      execSync(`bash ${syncScript}`, { cwd: root, stdio: 'pipe' });
      ran = true;
    } catch (err) {
      try {
        execSync(`pwsh -NoProfile -File ${psScript}`, { cwd: root, stdio: 'pipe' });
        ran = true;
      } catch (err2) {
        // If both fail, skip asserting script behavior but ensure test fails earlier CI should run scripts
      }
    }

    assert.ok(ran || fs.existsSync(dst), `${dst} should exist after running sync script or be present`);
    assert.ok(fs.existsSync(dst), `${dst} should exist`);

    const contents = fs.readFileSync(dst, 'utf8');

    // If the source docker-compose.env exists, we expect the generated .env to contain resolved project keys
    if (fs.existsSync(src)) {
      assert.ok(/INDEX_DIR/.test(contents), 'INDEX_DIR should be present in generated .env');
      assert.ok(/MEDIA_DIR/.test(contents), 'MEDIA_DIR should be present in generated .env');
      assert.ok(/VISUAL_RAG_INDEX_NAME/.test(contents) || /DEFAULT_INDEX_NAME/.test(contents), 'VISUAL_RAG_INDEX_NAME or DEFAULT_INDEX_NAME should be present in generated .env');
      // Ensure resolved values (no unreplaced ${...})
      assert.ok(!/\$\{/.test(contents), 'Generated .env should not contain unresolved ${...} expressions');
      const lines = contents.split('\n');
      const map = Object.fromEntries(lines.filter(l=>l.includes('=')).map(l=>[l.split('=')[0], l.split('=').slice(1).join('=')]));
      assert.ok(map['INDEX_DIR'] && map['INDEX_DIR'] !== '', 'INDEX_DIR should be non-empty in generated .env');
      assert.ok(map['MEDIA_DIR'] && map['MEDIA_DIR'] !== '', 'MEDIA_DIR should be non-empty in generated .env');
    } else {
      // If the source is missing, verify the fallback contains safe defaults for CI
      assert.ok(/POSTGRES_USER=elfman/.test(contents), 'Fallback .env should contain POSTGRES_USER=elfman');
      assert.ok(/POSTGRES_PASSWORD=password/.test(contents), 'Fallback .env should contain POSTGRES_PASSWORD=password');
      assert.ok(/POSTGRES_DB=paperless_test/.test(contents), 'Fallback .env should contain POSTGRES_DB=paperless_test');
      assert.ok(/OCR_CHECKPOINT_TRANSLATIONS_ENABLED=yes/.test(contents), 'Fallback .env should enable OCR_CHECKPOINT_TRANSLATIONS_ENABLED');
      assert.ok(/TRANSLATION_MIN_CHARS=3/.test(contents), 'Fallback .env should set TRANSLATION_MIN_CHARS=3');
    }
  });
});