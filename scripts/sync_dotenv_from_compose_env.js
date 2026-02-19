#!/usr/bin/env node
/**
 * Generate repo-root `.env` from `docker-compose.env`.
 * Source of truth stays in docker-compose.env; `.env` is compatibility only.
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcPath = path.join(rootDir, 'docker-compose.env');
const dstPath = path.join(rootDir, '.env');

const fallbackEntries = [
  ['POSTGRES_USER', 'elfman'],
  ['POSTGRES_PASSWORD', 'password'],
  ['POSTGRES_DB', 'paperless_test'],
  ['INDEX_DIR', '/tmp/index'],
  ['MEDIA_DIR', '/tmp/media'],
  ['DEFAULT_INDEX_NAME', 'test_index'],
  ['VISUAL_RAG_INDEX_NAME', 'test_index'],
  ['VIDEO_FRAME_INTERVAL', '1'],
  ['VIDEO_KEYFRAME_DETECTION', 'yes'],
  ['OCR_CHECKPOINT_TRANSLATIONS_ENABLED', 'yes'],
  ['TRANSLATION_MIN_CHARS', '3']
];

const interpolationPattern = /\$\{([^}:]+)(?::-([^}]*))?\}/g;

function stripInlineComment(value) {
  return value.replace(/\s+#.*$/, '');
}

function parseComposeEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const entries = new Map();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    const rawValue = stripInlineComment(match[2]);
    entries.set(key, rawValue);
  }

  return entries;
}

function resolveValue(value, entries, depth = 0) {
  if (depth > 20) return value;

  let changed = false;
  const next = value.replace(interpolationPattern, (_, varName, fallback) => {
    const composeValue = entries.get(varName);
    if (composeValue !== undefined && composeValue !== '') {
      changed = true;
      return resolveValue(composeValue, entries, depth + 1);
    }

    const processValue = process.env[varName];
    if (processValue !== undefined && processValue !== '') {
      changed = true;
      return processValue;
    }

    changed = true;
    return fallback || '';
  });

  if (!changed) return next;
  if (next === value) return next;
  return resolveValue(next, entries, depth + 1);
}

function writeEnv(entries, sourceLabel) {
  const header = [
    '# Auto-generated .env (compatibility for legacy docker-compose)',
    `# Generated from: ${sourceLabel}`,
    '# Do not edit directly — edit docker-compose.env and re-run: npm run env:sync',
    ''
  ].join('\n');

  const body = Array.from(entries.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(dstPath, `${header}${body}\n`, 'utf8');
  try {
    fs.chmodSync(dstPath, 0o600);
  } catch (_) {
    // Windows may not honor chmod; ignore.
  }
}

function generateFallback() {
  const entries = new Map(fallbackEntries);
  writeEnv(entries, 'fallback');
  console.warn(`Generated fallback ${dstPath}`);
}

function main() {
  if (!fs.existsSync(srcPath)) {
    console.warn(`WARNING: source env file not found at ${srcPath}`);
    generateFallback();
    return;
  }

  const parsed = parseComposeEnv(srcPath);
  const resolved = new Map();

  for (const [key, rawValue] of parsed.entries()) {
    resolved.set(key, resolveValue(rawValue, parsed));
  }

  writeEnv(resolved, srcPath);
  console.log(`Generated ${dstPath} from ${srcPath} (resolved values)`);
}

main();
