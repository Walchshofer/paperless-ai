#!/usr/bin/env node
/*
 * Direct esbuild CLI bundling for islands.
 * Workaround for environments that block child_process pipes (spawn EPERM).
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'public', 'js', 'dist');

function resolveEsbuildBin() {
  const envBin = process.env.ESBUILD_BINARY_PATH;
  if (envBin && fs.existsSync(envBin)) return envBin;

  if (process.platform === 'win32') {
    try {
      return require.resolve('@esbuild/win32-x64/esbuild.exe');
    } catch (err) {
      // fall through to local bin
    }
    const localCmd = path.join(projectRoot, 'node_modules', '.bin', 'esbuild.cmd');
    if (fs.existsSync(localCmd)) return localCmd;
  } else {
    const localBin = path.join(projectRoot, 'node_modules', '.bin', 'esbuild');
    if (fs.existsSync(localBin)) return localBin;
  }

  throw new Error('Unable to locate esbuild binary. Set ESBUILD_BINARY_PATH.');
}

function cleanDist() {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
}

const entries = {
  'island-runtime': 'src/islands/runtime.browser.tsx',
  'manual-editor': 'src/islands/ManualEditorIsland.tsx',
  'feedback-controls': 'src/islands/FeedbackControlsIsland.tsx',
  'history-tabs': 'src/islands/HistoryTabsIsland.tsx',
  'overlay-viewer': 'src/islands/OverlayViewerIsland.tsx',
  'playground': 'src/islands/PlaygroundIsland.tsx',
  'visual-annotation': 'src/islands/VisualAnnotationIsland.tsx',
  'overview-dashboard': 'src/islands/OverviewDashboardIsland.tsx',
  'settings-sidebar': 'src/islands/SettingsSidebarIsland.tsx',
  'connection-settings': 'src/islands/ConnectionSettingsIsland.tsx',
  'ai-provider': 'src/islands/AIProviderIsland.tsx',
  'expert-models': 'src/islands/ExpertModelsIsland.tsx',
  'restart-banner': 'src/islands/RestartBannerIsland.tsx',
  'developer-settings': 'src/islands/DeveloperSettingsIsland.tsx',
  'presets-manager': 'src/islands/PresetsManagerIsland.tsx',
};

const commonArgs = [
  '--bundle',
  '--format=esm',
  '--platform=browser',
  '--target=es2020',
  '--jsx=automatic',
  '--jsx-import-source=preact',
  '--alias:react=preact/compat',
  '--alias:react-dom=preact/compat',
];

function run() {
  const esbuildBin = resolveEsbuildBin();
  cleanDist();

  for (const [name, input] of Object.entries(entries)) {
    const outfile = name === 'island-runtime'
      ? path.join(distDir, 'island-runtime.js')
      : path.join(distDir, `${name}.island.js`);
    const args = [path.join(projectRoot, input), ...commonArgs, `--outfile=${outfile}`];
    const result = spawnSync(esbuildBin, args, {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
  }
}

try {
  run();
} catch (err) {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}
