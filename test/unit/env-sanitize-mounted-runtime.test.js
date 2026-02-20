const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('env:sanitize mounted runtime path', function () {
  const scriptPath = path.resolve(
    __dirname,
    '../../scripts/sanitize_runtime_env.js'
  );
  let workspaceRoot;
  let projectRoot;
  let mountedRuntimePath;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'env-sanitize-'));
    projectRoot = path.join(workspaceRoot, 'paperless-ai');
    mountedRuntimePath = path.join(
      workspaceRoot,
      'paperless-ngx',
      'data',
      'paperless-ai',
      'runtime.env'
    );

    fs.mkdirSync(path.dirname(mountedRuntimePath), { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(
      mountedRuntimePath,
      [
        'PAPERLESS_API_TOKEN=stale-token',
        'TOKEN_LIMIT=120000',
        'ENABLE_VISUAL_RAG=yes',
        ''
      ].join('\n'),
      'utf8'
    );
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  function assertMountedRuntimeSanitized(result) {
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    assert.match(
      result.stdout,
      /Removed protected keys from \.\.\/paperless-ngx\/data\/paperless-ai\/runtime\.env/
    );

    const content = fs.readFileSync(mountedRuntimePath, 'utf8');
    assert.ok(!content.includes('PAPERLESS_API_TOKEN='));
    assert.ok(content.includes('TOKEN_LIMIT=120000'));
    assert.ok(content.includes('ENABLE_VISUAL_RAG=yes'));

    const backupFiles = fs
      .readdirSync(path.dirname(mountedRuntimePath))
      .filter((fileName) => fileName.startsWith('runtime.env.bak-'));
    assert.ok(backupFiles.length > 0, 'expected a backup file');
  }

  it('sanitizes mounted runtime file when --path is provided', () => {
    const result = spawnSync(
      'node',
      [
        scriptPath,
        '--root',
        projectRoot,
        '--path',
        '../paperless-ngx/data/paperless-ai/runtime.env'
      ],
      { encoding: 'utf8' }
    );

    assertMountedRuntimeSanitized(result);
  });

  it('supports npm arg forwarding without extra --', () => {
    const npmScriptPath = scriptPath.split(path.sep).join('/');
    fs.writeFileSync(
      path.join(projectRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'env-sanitize-test',
          private: true,
          scripts: {
            'env:sanitize': `node "${npmScriptPath}" --root .`
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const result = spawnSync(
      'npm run env:sanitize -- --path ../paperless-ngx/data/paperless-ai/runtime.env',
      {
        cwd: projectRoot,
        encoding: 'utf8',
        shell: true
      }
    );

    assertMountedRuntimeSanitized(result);
  });
});
