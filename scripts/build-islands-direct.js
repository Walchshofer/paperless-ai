#!/usr/bin/env node
/*
 * Direct esbuild CLI bundling for islands.
 * Workaround for environments that block child_process pipes (spawn EPERM).
 */
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'public', 'js', 'dist');

const entries = {
  'island-runtime': 'src/islands/runtime.browser.tsx',
  'unified-workspace': 'src/islands/UnifiedWorkspaceIsland.tsx',
  'document-context-bar': 'src/islands/DocumentContextBarIsland.tsx',
  'context-sidebar': 'src/islands/ContextSidebarIsland.tsx',
  'manual-editor': 'src/islands/ManualEditorIsland.tsx',
  'smart-metadata': 'src/islands/SmartMetadataIsland.tsx',
  'feedback-controls': 'src/islands/FeedbackControlsIsland.tsx',
  'history-tabs': 'src/islands/HistoryTabsIsland.tsx',
  'history-manager': 'src/islands/HistoryManagerIsland.tsx',
  'overlay-viewer': 'src/islands/OverlayViewerIsland.tsx',
  'playground': 'src/islands/PlaygroundIsland.tsx',
  'visual-annotation': 'src/islands/VisualAnnotationIsland.tsx',
  'chat-workspace': 'src/islands/ChatWorkspaceIsland.tsx',
  'overview-dashboard': 'src/islands/OverviewDashboardIsland.tsx',
  'settings-sidebar': 'src/islands/SettingsSidebarIsland.tsx',
  'connection-settings': 'src/islands/ConnectionSettingsIsland.tsx',
  'ai-provider': 'src/islands/AIProviderIsland.tsx',
  'expert-models': 'src/islands/ExpertModelsIsland.tsx',
  'restart-banner': 'src/islands/RestartBannerIsland.tsx',
  'developer-settings': 'src/islands/DeveloperSettingsIsland.tsx',
  'presets-manager': 'src/islands/PresetsManagerIsland.tsx',
  'prompts-settings': 'src/islands/PromptsSettingsIsland.tsx',
  'manual-workspace': 'src/islands/ManualWorkspaceIsland.tsx',
  'view-mode-toggle': 'src/islands/ViewModeToggleIsland.tsx',
  'document-content': 'src/islands/DocumentContentIsland.tsx',
  'visual-overlays': 'src/islands/VisualOverlaysIsland.tsx',
  'tags-manager': 'src/islands/TagsManagerIsland.tsx',
  'ai-analysis': 'src/islands/AIAnalysisIsland.tsx',
  'export-panel': 'src/islands/ExportPanelIsland.tsx',
  'resizable-layout': 'src/islands/ResizableLayoutIsland.tsx'
};

function cleanDist() {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
}

async function run() {
  cleanDist();
  console.log('Building islands using esbuild JS API...');

  const entryPoints = {};
  for (const [name, input] of Object.entries(entries)) {
    const outfile = name === 'island-runtime'
      ? path.join(distDir, 'island-runtime.js')
      : path.join(distDir, `${name}.island.js`);
    entryPoints[outfile] = path.join(projectRoot, input);
  }

  try {
    const result = await esbuild.build({
      entryPoints: Object.entries(entries).map(([name, input]) => ({
        in: path.join(projectRoot, input),
        out: name === 'island-runtime' ? 'island-runtime' : `${name}.island`
      })),
      bundle: true,
      outdir: distDir,
      format: 'esm',
      platform: 'browser',
      target: 'es2020',
      jsx: 'automatic',
      jsxImportSource: 'preact',
      alias: {
        'react': 'preact/compat',
        'react-dom': 'preact/compat',
      },
      loader: {
        '.module.css': 'local-css',
        '.css': 'css',
        '.png': 'file',
        '.svg': 'file',
        '.jpg': 'file',
      },
      minify: process.env.NODE_ENV === 'production',
      sourcemap: true,
      metafile: true,
      logLevel: 'info',
    });

    console.log('Build completed successfully.');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

run();
