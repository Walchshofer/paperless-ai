#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const {
  isProtectedRuntimeKey,
  findProtectedRuntimeKeys
} = require('../config/envPolicy');

const DEFAULT_MOUNTED_RUNTIME_RELATIVE_PATH = path.join(
  '..',
  'paperless-ngx',
  'data',
  'paperless-ai',
  'runtime.env'
);

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  return dotenv.parse(content);
}

function getArgValue(args, flagName) {
  const index = args.indexOf(flagName);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function resolveCliOptions(argv = process.argv.slice(2)) {
  const rootArg = getArgValue(argv, '--root');
  const mountedRuntimeArg = getArgValue(argv, '--mounted-runtime');
  return {
    preflight: argv.includes('--preflight'),
    rootDir: rootArg ? path.resolve(rootArg) : path.resolve(__dirname, '..'),
    mountedRuntimePath: mountedRuntimeArg || null
  };
}

function resolveAuditPaths(options) {
  const rootDir = options.rootDir;
  const mountedRuntimePath = options.mountedRuntimePath
    ? path.resolve(rootDir, options.mountedRuntimePath)
    : path.resolve(rootDir, DEFAULT_MOUNTED_RUNTIME_RELATIVE_PATH);
  return {
    rootDir,
    dockerComposeEnvPath: path.join(rootDir, 'docker-compose.env'),
    dotEnvPath: path.join(rootDir, '.env'),
    runtimeEnvPath: path.join(rootDir, 'data', 'runtime.env'),
    legacyEnvPath: path.join(rootDir, 'data', '.env'),
    mountedRuntimePath
  };
}

function formatPathLabel(rootDir, filePath) {
  const relative = path.relative(rootDir, filePath);
  if (!relative || relative === '') return '.';
  return relative.split(path.sep).join('/');
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

function reportProtectedRuntimeKeys(fileLabel, envMap, remediationCommand) {
  const protectedKeys = findProtectedRuntimeKeys(
    envMap ? Object.keys(envMap) : []
  );
  if (protectedKeys.length === 0) return false;
  console.log(`[env:audit] ERROR: ${fileLabel} contains protected keys:`);
  for (const key of protectedKeys) {
    console.log(`  - ${key}`);
  }
  if (remediationCommand) {
    console.log(`[env:audit] Cleanup: ${remediationCommand}`);
  }
  return true;
}

function runAudit(options = {}) {
  const resolvedOptions = {
    preflight: Boolean(options.preflight),
    ...resolveAuditPaths({
      rootDir: options.rootDir || path.resolve(__dirname, '..'),
      mountedRuntimePath: options.mountedRuntimePath || null
    })
  };
  const authoritativeEnv = parseEnv(resolvedOptions.dockerComposeEnvPath);
  const compatibilityEnv = parseEnv(resolvedOptions.dotEnvPath);
  const runtimeEnv = parseEnv(resolvedOptions.runtimeEnvPath);
  const legacyEnv = parseEnv(resolvedOptions.legacyEnvPath);
  const mountedRuntimeEnv = parseEnv(resolvedOptions.mountedRuntimePath);

  const mountedRuntimeLabel = formatPathLabel(
    resolvedOptions.rootDir,
    resolvedOptions.mountedRuntimePath
  );
  const defaultMountedRuntimeLabel = formatPathLabel(
    resolvedOptions.rootDir,
    path.resolve(resolvedOptions.rootDir, DEFAULT_MOUNTED_RUNTIME_RELATIVE_PATH)
  );
  const mountedCleanupCommand = mountedRuntimeLabel === defaultMountedRuntimeLabel
    ? 'npm run env:sanitize:mounted'
    : `npm run env:sanitize -- --path ${mountedRuntimeLabel}`;

  printFilePresence('docker-compose.env', resolvedOptions.dockerComposeEnvPath);
  printFilePresence('.env (compatibility)', resolvedOptions.dotEnvPath);
  printFilePresence('data/runtime.env', resolvedOptions.runtimeEnvPath);
  printFilePresence('data/.env (legacy)', resolvedOptions.legacyEnvPath);
  printFilePresence(mountedRuntimeLabel, resolvedOptions.mountedRuntimePath);

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

  if (reportProtectedRuntimeKeys(
    'data/runtime.env',
    runtimeEnv,
    'npm run env:sanitize'
  )) {
    hasErrors = true;
  }

  if (reportProtectedRuntimeKeys('data/.env', legacyEnv)) {
    hasErrors = true;
    console.log('[env:audit] Remove deprecated data/.env or migrate safely.');
  }

  const mountedSharesRuntimePath = path.resolve(resolvedOptions.runtimeEnvPath)
    === path.resolve(resolvedOptions.mountedRuntimePath);
  if (
    !mountedSharesRuntimePath
    && reportProtectedRuntimeKeys(
      mountedRuntimeLabel,
      mountedRuntimeEnv,
      mountedCleanupCommand
    )
  ) {
    hasErrors = true;
  }

  if (!hasErrors) {
    console.log(
      '[env:audit] OK: SOT policy passed (docker-compose.env authoritative, '
      + 'runtime env free of protected keys).'
    );
  } else if (resolvedOptions.preflight) {
    console.log(
      '[env:audit] PRE-FLIGHT: policy violations detected. Startup may '
      + 'continue, but cleanup is required.'
    );
  }

  return {
    hasErrors
  };
}

if (require.main === module) {
  const cliOptions = resolveCliOptions();
  const result = runAudit(cliOptions);
  if (result.hasErrors && !cliOptions.preflight) {
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_MOUNTED_RUNTIME_RELATIVE_PATH,
  resolveCliOptions,
  resolveAuditPaths,
  runAudit,
  formatPathLabel
};
