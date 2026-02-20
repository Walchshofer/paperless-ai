const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('env:audit mounted runtime preflight', function () {
  const scriptPath = path.resolve(__dirname, '../../scripts/audit_env_sot.js');
  let workspaceRoot;
  let projectRoot;

  function writeBaseEnvFiles() {
    const baseEnvLines = [
      'POSTGRES_USER=paperless',
      'POSTGRES_PASSWORD=secret',
      'POSTGRES_DB=paperless',
      'PAPERLESS_API_URL=http://webserver:8000/api',
      'PAPERLESS_API_TOKEN=test-token'
    ].join('\n');

    fs.writeFileSync(
      path.join(projectRoot, 'docker-compose.env'),
      baseEnvLines,
      'utf8'
    );
    fs.writeFileSync(path.join(projectRoot, '.env'), baseEnvLines, 'utf8');
  }

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'env-audit-'));
    projectRoot = path.join(workspaceRoot, 'paperless-ai');
    fs.mkdirSync(path.join(projectRoot, 'data'), { recursive: true });
    fs.mkdirSync(
      path.join(workspaceRoot, 'paperless-ngx', 'data', 'paperless-ai'),
      { recursive: true }
    );
    writeBaseEnvFiles();

    fs.writeFileSync(
      path.join(projectRoot, 'data', 'runtime.env'),
      'TOKEN_LIMIT=128000\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(
        workspaceRoot,
        'paperless-ngx',
        'data',
        'paperless-ai',
        'runtime.env'
      ),
      [
        'PAPERLESS_API_URL=http://stale-host:8000/api',
        'TOKEN_LIMIT=64000',
        ''
      ].join('\n'),
      'utf8'
    );
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('detects protected keys in mounted runtime file before startup', () => {
    const result = spawnSync(
      'node',
      [scriptPath, '--root', projectRoot, '--preflight'],
      { encoding: 'utf8' }
    );

    assert.strictEqual(result.status, 0);
    assert.match(
      result.stdout,
      /\.\.\/paperless-ngx\/data\/paperless-ai\/runtime\.env contains protected keys/
    );
    assert.match(result.stdout, /PAPERLESS_API_URL/);
    assert.match(result.stdout, /PRE-FLIGHT/);
  });

  it('fails when mounted runtime file has protected keys in strict mode', () => {
    const result = spawnSync('node', [scriptPath, '--root', projectRoot], {
      encoding: 'utf8'
    });

    assert.notStrictEqual(result.status, 0);
    assert.match(
      result.stdout,
      /\.\.\/paperless-ngx\/data\/paperless-ai\/runtime\.env contains protected keys/
    );
  });
});
