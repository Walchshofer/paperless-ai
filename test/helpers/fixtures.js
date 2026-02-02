const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const FIXTURE_PATH = path.join(process.cwd(), 'test', '.auth', 'fixtures.json');
const LOG_PATH = path.join(
  process.cwd(),
  'test',
  'artifacts',
  'phase-03',
  'fixture-seed.md'
);

const truthy = (value) => ['1', 'true', 'yes'].includes(
  String(value || '').toLowerCase()
);

function readEnvFile() {
  const envPath = path.join(process.cwd(), 'data', '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function resolveEnvValue(key, fallbackEnv) {
  if (process.env[key]) return process.env[key];
  if (fallbackEnv && fallbackEnv[key]) return fallbackEnv[key];
  return undefined;
}

function resolvePaperlessConfig() {
  const fallbackEnv = readEnvFile();
  let apiUrl = resolveEnvValue('PAPERLESS_API_URL', fallbackEnv);
  const apiToken = resolveEnvValue('PAPERLESS_API_TOKEN', fallbackEnv);

  if (apiUrl && apiUrl.endsWith('/')) {
    apiUrl = apiUrl.slice(0, -1);
  }

  // Handle Docker-to-Host mapping for E2E tests running on Windows host
  if (apiUrl) {
    try {
      const url = new URL(apiUrl);
      if (url.hostname === 'webserver' || url.hostname === 'paperless-ai' || url.hostname === 'paperless_ai') {
        const oldHost = url.hostname;
        url.hostname = 'localhost';
        console.warn(`[e2e:fixtures] Mapping ${oldHost} to localhost for API access: ${url.toString()}`);
        apiUrl = url.toString();
        if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
      }
    } catch (e) { /* ignore parse errors */ }
  }

  if (!apiUrl || !apiToken) {
    throw new Error(
      'Missing PAPERLESS_API_URL or PAPERLESS_API_TOKEN for E2E fixtures.'
    );
  }

  return { apiUrl, apiToken };
}

async function fetchJson(url, apiToken, allowNotFound = false) {
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Token ${apiToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (allowNotFound && resp.status === 404) return null;
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Fetch failed ${resp.status} for ${url}: ${body}`);
  }
  return resp.json();
}

async function getDocumentById(apiUrl, apiToken, docId) {
  if (!docId) return null;
  const url = `${apiUrl}/documents/${docId}/`;
  return fetchJson(url, apiToken, true);
}

async function getFirstDocument(apiUrl, apiToken) {
  const url = new URL(`${apiUrl}/documents/`);
  url.searchParams.set('page_size', '1');
  url.searchParams.set('ordering', 'id');
  const data = await fetchJson(url.toString(), apiToken);
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.length > 0 ? results[0] : null;
}

async function selectDocumentFixture(apiUrl, apiToken) {
  const preferredEnvId =
    process.env.TEST_DOC_ID ||
    process.env.PLAYWRIGHT_HISTORY_DOC_ID ||
    process.env.E2E_DOC_ID;

  if (preferredEnvId) {
    const doc = await getDocumentById(apiUrl, apiToken, preferredEnvId);
    if (!doc) {
      throw new Error(
        `E2E doc ${preferredEnvId} not found in Paperless API.`
      );
    }
    return { doc, source: 'env' };
  }

  const preferredIds = [74, 1];
  for (const candidate of preferredIds) {
    const doc = await getDocumentById(apiUrl, apiToken, candidate);
    if (doc) return { doc, source: `doc:${candidate}` };
  }

  const fallbackDoc = await getFirstDocument(apiUrl, apiToken);
  if (!fallbackDoc) {
    throw new Error('No documents available from Paperless API.');
  }

  return { doc: fallbackDoc, source: 'first-doc' };
}

function writeFixtureFile(payload) {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(payload, null, 2));
}

function writeSeedLog(payload) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  const lines = [
    '# Fixture Seed Log',
    '',
    `timestamp: ${new Date().toISOString()}`,
    `doc_id: ${payload.docId}`,
    `history_doc_id: ${payload.historyDocId}`,
    `source: ${payload.source}`,
    `title: ${payload.title || ''}`,
    `correspondent_id: ${payload.correspondentId ?? ''}`,
    `tag_ids: ${(payload.tagIds || []).join(', ')}`,
    ''
  ];
  fs.writeFileSync(LOG_PATH, lines.join('\n'));
}

async function ensureE2EFixtures() {
  if (truthy(process.env.E2E_SKIP_FIXTURE_SETUP)) {
    console.warn('[e2e] Skipping fixture setup (E2E_SKIP_FIXTURE_SETUP).');
    return;
  }

  const { apiUrl, apiToken } = resolvePaperlessConfig();
  const { doc, source } = await selectDocumentFixture(apiUrl, apiToken);

  const fixturePayload = {
    docId: doc.id,
    historyDocId: doc.id,
    title: doc.title || '',
    correspondentId: doc.correspondent || null,
    tagIds: Array.isArray(doc.tags) ? doc.tags : [],
    created: doc.created || null,
    source,
    paperlessApiUrl: apiUrl
  };

  writeFixtureFile(fixturePayload);
  writeSeedLog(fixturePayload);
}

function loadFixtureData() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(
      `Missing E2E fixture file at ${FIXTURE_PATH}. Run Playwright global setup or set E2E_SKIP_FIXTURE_SETUP=false.`
    );
  }
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf8');
  return JSON.parse(raw);
}

function getTestDocId() {
  const data = loadFixtureData();
  return Number(data.docId);
}

function getHistoryDocId() {
  const data = loadFixtureData();
  return Number(data.historyDocId || data.docId);
}

module.exports = {
  ensureE2EFixtures,
  loadFixtureData,
  getTestDocId,
  getHistoryDocId
};
