const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const setupService = require('../../services/setupService');

describe('setupService migration - data/.env -> data/runtime.env', function () {
  const tmpRoot = path.join(__dirname, 'tmp_migration_test');
  const dataDir = path.join(tmpRoot, 'data');
  const legacyPath = path.join(dataDir, '.env');
  const runtimePath = path.join(dataDir, 'runtime.env');

  beforeEach(async () => {
    // Clean up and prepare temp dir
    await fs.rm(tmpRoot, { recursive: true, force: true });
    await fs.mkdir(dataDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('copies legacy .env to runtime.env and renames legacy to .env.migrated', async () => {
    const content = 'PAPERLESS_API_URL=http://localhost:8000/api\nPAPERLESS_API_TOKEN=token123\n';
    await fs.writeFile(legacyPath, content, 'utf8');

    // Ensure runtime doesn't exist
    try { await fs.unlink(runtimePath); } catch (e) { /* ignore */ }

    const migrated = await setupService.migrateLegacyEnv(tmpRoot);
    assert.strictEqual(migrated, true, 'Expected migration to have occurred');

    const runtimeContent = await fs.readFile(runtimePath, 'utf8');
    assert.ok(runtimeContent.includes('PAPERLESS_API_URL=http://localhost:8000/api'));

    // legacy should be renamed
    let legacyRenamed = false;
    try { await fs.access(legacyPath + '.migrated'); legacyRenamed = true; } catch (e) { legacyRenamed = false; }
    assert.ok(legacyRenamed, 'Expected legacy file to be renamed to .migrated');
  });
});