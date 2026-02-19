#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { isProtectedRuntimeKey } = require('../config/envPolicy');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'data', 'runtime.env');

function timestamp() {
  const now = new Date();
  return now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function run() {
  if (!fs.existsSync(runtimePath)) {
    console.log('[env:sanitize] data/runtime.env not found. Nothing to do.');
    return;
  }

  const original = fs.readFileSync(runtimePath, 'utf8');
  const lines = original.split('\n');
  const removedKeys = [];
  const sanitizedLines = [];

  for (const line of lines) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (!match) {
      sanitizedLines.push(line);
      continue;
    }

    const key = match[1];
    if (isProtectedRuntimeKey(key)) {
      removedKeys.push(key);
      continue;
    }
    sanitizedLines.push(line);
  }

  if (removedKeys.length === 0) {
    console.log('[env:sanitize] No protected keys found in data/runtime.env.');
    return;
  }

  const backupPath = `${runtimePath}.bak-${timestamp()}`;
  fs.copyFileSync(runtimePath, backupPath);
  fs.writeFileSync(runtimePath, sanitizedLines.join('\n'), 'utf8');

  console.log('[env:sanitize] Removed protected keys from data/runtime.env:');
  for (const key of removedKeys) {
    console.log(`  - ${key}`);
  }
  console.log(`[env:sanitize] Backup created: ${backupPath}`);
}

run();
