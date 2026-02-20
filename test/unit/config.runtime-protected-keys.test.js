const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('config runtime protected-key drift handling', function () {
  const configPath = path.resolve(__dirname, '../../config/config.js');
  let workspaceRoot;
  let projectRoot;

  function writeFile(relativePath, content) {
    const absolutePath = path.join(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'config-runtime-'));
    projectRoot = path.join(workspaceRoot, 'paperless-ai');
    fs.mkdirSync(projectRoot, { recursive: true });

    const baseEnv = [
      'POSTGRES_USER=paperless',
      'POSTGRES_PASSWORD=secret',
      'POSTGRES_DB=paperless',
      'PAPERLESS_API_URL=http://webserver:8000/api',
      'PAPERLESS_API_TOKEN=test-token'
    ].join('\n');

    writeFile('docker-compose.env', baseEnv);
    writeFile('.env', baseEnv);
    writeFile(
      path.join('data', 'runtime.env'),
      [
        'PAPERLESS_API_URL=http://stale-host:8000/api',
        'TOKEN_LIMIT=64000',
        ''
      ].join('\n')
    );
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('ignores protected keys from runtime env and does not fail config load', () => {
    const script = `
      process.chdir(${JSON.stringify(projectRoot)});
      process.env.NODE_ENV = 'production';
      require(${JSON.stringify(configPath)});
      process.stdout.write('CONFIG_LOAD_OK\\n');
      process.stdout.write('PAPERLESS_API_URL=' + process.env.PAPERLESS_API_URL + '\\n');
    `;

    const result = spawnSync('node', ['-e', script], {
      encoding: 'utf8',
      env: { ...process.env }
    });

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /CONFIG_LOAD_OK/);
    assert.match(
      result.stdout,
      /PAPERLESS_API_URL=http:\/\/webserver:8000\/api/
    );
    assert.match(
      result.stderr,
      /Ignoring protected keys in data[\\/]runtime\.env: PAPERLESS_API_URL/
    );
  });
});
