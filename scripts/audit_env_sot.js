#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const {
  isProtectedRuntimeKey,
  findProtectedRuntimeKeys
} = require('../config/envPolicy');

const rootDir = path.resolve(__dirname, '..');
const dockerComposeEnvPath = path.join(rootDir, 'docker-compose.env');
const dotEnvPath = path.join(rootDir, '.env');
const runtimeEnvPath = path.join(rootDir, 'data', 'runtime.env');
const legacyEnvPath = path.join(rootDir, 'data', '.env');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  return dotenv.parse(content);
}

function getProtectedMismatches(authoritativeEnv, compatibilityEnv) {
  if (!authoritativeEnv || !compatibilityEnv) return [];
  const keys = new Set([
    ...Object.keys(authoritativeEnv),
    ...Object.keys(compatibilityEnv)
  ]);
  const mismatches = [];

  for (const key of keys) {
    if (!isProtectedRuntimeKey(key)) continue;
    const left = authoritativeEnv[key];
    const right = compatibilityEnv[key];
    if (left !== undefined && right !== undefined && left !== right) {
      mismatches.push(key);
    }
  }
  return mismatches;
}

function printFilePresence(label, filePath) {
  const present = fs.existsSync(filePath);
  console.log(`[env:audit] ${label}: ${present ? 'present' : 'missing'}`);
}

function run() {
  const authoritativeEnv = parseEnv(dockerComposeEnvPath);
  const compatibilityEnv = parseEnv(dotEnvPath);
  const runtimeEnv = parseEnv(runtimeEnvPath);
  const legacyEnv = parseEnv(legacyEnvPath);

  printFilePresence('docker-compose.env', dockerComposeEnvPath);
  printFilePresence('.env (compatibility)', dotEnvPath);
  printFilePresence('data/runtime.env', runtimeEnvPath);
  printFilePresence('data/.env (legacy)', legacyEnvPath);

  let hasErrors = false;

  const protectedMismatches = getProtectedMismatches(
    authoritativeEnv,
    compatibilityEnv
  );
  if (protectedMismatches.length > 0) {
    hasErrors = true;
    console.log(
      '[env:audit] ERROR: Protected key mismatch between docker-compose.env '
      + 'and .env:'
    );
    for (const key of protectedMismatches) {
      console.log(`  - ${key}`);
    }
    console.log('[env:audit] Run `npm run env:sync` to regenerate .env.');
  }

  const runtimeProtectedKeys = findProtectedRuntimeKeys(
    runtimeEnv ? Object.keys(runtimeEnv) : []
  );
  if (runtimeProtectedKeys.length > 0) {
    hasErrors = true;
    console.log(
      '[env:audit] ERROR: data/runtime.env contains protected keys:'
    );
    for (const key of runtimeProtectedKeys) {
      console.log(`  - ${key}`);
    }
    console.log('[env:audit] Run `npm run env:sanitize` to remove them.');
  }

  const legacyProtectedKeys = findProtectedRuntimeKeys(
    legacyEnv ? Object.keys(legacyEnv) : []
  );
  if (legacyProtectedKeys.length > 0) {
    hasErrors = true;
    console.log('[env:audit] ERROR: data/.env contains protected keys:');
    for (const key of legacyProtectedKeys) {
      console.log(`  - ${key}`);
    }
    console.log('[env:audit] Remove deprecated data/.env or migrate safely.');
  }

  if (!hasErrors) {
    console.log(
      '[env:audit] OK: SOT policy passed (docker-compose.env authoritative, '
      + 'runtime env free of protected keys).'
    );
  } else {
    process.exitCode = 1;
  }
}

run();
