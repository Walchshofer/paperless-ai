const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('env:sanitize mounted runtime workflow', function () {
  const sanitizeScriptPath = path.resolve(
    __dirname,
    '../../scripts/sanitize_runtime_env.js'
  );
  const auditScriptPath = path.resolve(
    __dirname,
    '../../scripts/audit_env_sot.js'
  );
  let workspaceRoot;
  let projectRoot;
  let mountedRuntimePath;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'env-workflow-'));
    projectRoot = path.join(workspaceRoot, 'paperless-ai');
    mountedRuntimePath = path.join(
      workspaceRoot,
      'paperless-ngx',
      'data',
      'paperless-ai',
      'runtime.env'
    );

    fs.mkdirSync(path.join(projectRoot, 'data'), { recursive: true });
    fs.mkdirSync(path.dirname(mountedRuntimePath), { recursive: true });

    const baseEnv = [
      'POSTGRES_USER=paperless',
      'POSTGRES_PASSWORD=secret',
      'POSTGRES_DB=paperless',
      'PAPERLESS_API_URL=http://webserver:8000/api',
      'PAPERLESS_API_TOKEN=test-token'
    ].join('\n');

    fs.writeFileSync(path.join(projectRoot, 'docker-compose.env'), baseEnv);
    fs.writeFileSync(path.join(projectRoot, '.env'), baseEnv);
    fs.writeFileSync(
      path.join(projectRoot, 'data', 'runtime.env'),
      'TOKEN_LIMIT=128000\n',
      'utf8'
    );
    fs.writeFileSync(
      mountedRuntimePath,
      ['PAPERLESS_API_TOKEN=stale-token', 'TOKEN_LIMIT=64000', ''].join('\n'),
      'utf8'
    );

    const sanitizeScript = sanitizeScriptPath.split(path.sep).join('/');
    fs.writeFileSync(
      path.join(projectRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'env-workflow-test',
          private: true,
          scripts: {
            'env:sanitize:mounted': `node "${sanitizeScript}" --root . --path ../paperless-ngx/data/paperless-ai/runtime.env`
          }
        },
        null,
        2
      ),
      'utf8'
    );
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('sanitizes mounted runtime and passes preflight audit', () => {
    const sanitizeResult = spawnSync('npm run env:sanitize:mounted', {
      cwd: projectRoot,
      encoding: 'utf8',
      shell: true
    });

    assert.strictEqual(
      sanitizeResult.status,
      0,
      sanitizeResult.stderr || sanitizeResult.stdout
    );
    assert.match(
      sanitizeResult.stdout,
      /Removed protected keys from \.\.\/paperless-ngx\/data\/paperless-ai\/runtime\.env/
    );

    const mountedContent = fs.readFileSync(mountedRuntimePath, 'utf8');
    assert.ok(!mountedContent.includes('PAPERLESS_API_TOKEN='));
    assert.ok(mountedContent.includes('TOKEN_LIMIT=64000'));

    const auditResult = spawnSync(
      'node',
      [auditScriptPath, '--root', projectRoot, '--preflight'],
      { encoding: 'utf8' }
    );
    assert.strictEqual(
      auditResult.status,
      0,
      auditResult.stderr || auditResult.stdout
    );
    assert.match(auditResult.stdout, /\[env:audit\] OK: SOT policy passed/);
  });
});
