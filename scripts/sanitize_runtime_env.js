#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { isProtectedRuntimeKey } = require('../config/envPolicy');

const DEFAULT_RUNTIME_RELATIVE_PATH = path.join('data', 'runtime.env');

function timestamp() {
  const now = new Date();
  return now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function getArgValue(args, flagName) {
  const equalsPrefix = `${flagName}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === flagName) {
      return args[index + 1] || null;
    }
    if (arg.startsWith(equalsPrefix)) {
      return arg.slice(equalsPrefix.length) || null;
    }
  }
  return null;
}

function getPositionalArg(args) {
  for (const arg of args) {
    if (!arg.startsWith('-')) {
      return arg;
    }
  }
  return null;
}

function formatPathLabel(rootDir, filePath) {
  const relative = path.relative(rootDir, filePath);
  if (!relative || relative === '') return '.';
  return relative.split(path.sep).join('/');
}

function resolveCliOptions(argv = process.argv.slice(2), env = process.env) {
  const rootArg = getArgValue(argv, '--root');
  let pathArg = getArgValue(argv, '--path');
  if (
    !pathArg
    && env
    && env.npm_lifecycle_event === 'env:sanitize'
    && argv.length === 1
  ) {
    pathArg = getPositionalArg(argv);
  }
  const rootDir = rootArg ? path.resolve(rootArg) : path.resolve(__dirname, '..');
  const runtimePath = pathArg
    ? path.resolve(rootDir, pathArg)
    : path.resolve(rootDir, DEFAULT_RUNTIME_RELATIVE_PATH);
  return {
    rootDir,
    runtimePath,
    runtimePathLabel: formatPathLabel(rootDir, runtimePath)
  };
}

function sanitizeRuntimeEnvFile(options = {}) {
  const resolvedOptions = {
    rootDir: options.rootDir || path.resolve(__dirname, '..'),
    runtimePath: options.runtimePath
      || path.resolve(options.rootDir || path.resolve(__dirname, '..'),
        DEFAULT_RUNTIME_RELATIVE_PATH),
    runtimePathLabel: options.runtimePathLabel || null
  };
  if (!resolvedOptions.runtimePathLabel) {
    resolvedOptions.runtimePathLabel = formatPathLabel(
      resolvedOptions.rootDir,
      resolvedOptions.runtimePath
    );
  }

  if (!fs.existsSync(resolvedOptions.runtimePath)) {
    console.log(
      `[env:sanitize] ${resolvedOptions.runtimePathLabel} not found. `
      + 'Nothing to do.'
    );
    return {
      changed: false,
      removedKeys: [],
      backupPath: null
    };
  }

  const original = fs.readFileSync(resolvedOptions.runtimePath, 'utf8');
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
    console.log(
      '[env:sanitize] No protected keys found in '
      + `${resolvedOptions.runtimePathLabel}.`
    );
    return {
      changed: false,
      removedKeys: [],
      backupPath: null
    };
  }

  const backupPath = `${resolvedOptions.runtimePath}.bak-${timestamp()}`;
  fs.copyFileSync(resolvedOptions.runtimePath, backupPath);
  fs.writeFileSync(resolvedOptions.runtimePath, sanitizedLines.join('\n'), 'utf8');

  console.log(
    '[env:sanitize] Removed protected keys from '
    + `${resolvedOptions.runtimePathLabel}:`
  );
  for (const key of removedKeys) {
    console.log(`  - ${key}`);
  }
  console.log(`[env:sanitize] Backup created: ${backupPath}`);

  return {
    changed: true,
    removedKeys,
    backupPath
  };
}

function run() {
  const options = resolveCliOptions();
  sanitizeRuntimeEnvFile(options);
}

if (require.main === module) {
  run();
}

module.exports = {
  DEFAULT_RUNTIME_RELATIVE_PATH,
  resolveCliOptions,
  sanitizeRuntimeEnvFile,
  formatPathLabel
};
