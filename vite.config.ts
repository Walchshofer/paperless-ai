/// <reference types="vitest" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat'
    }
  },
  publicDir: false,
  css: {
    modules: {
      scopeBehaviour: 'local',
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[name]__[local]___[hash:base64:5]'
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'public/js/dist'),
    emptyOutDir: true,
    lib: {
      entry: {
        'unified-workspace': path.resolve(__dirname, 'src/islands/UnifiedWorkspaceIsland.tsx'),
        'document-context-bar': path.resolve(__dirname, 'src/islands/DocumentContextBarIsland.tsx'),
        'context-sidebar': path.resolve(__dirname, 'src/islands/ContextSidebarIsland.tsx'),
        'island-runtime': path.resolve(__dirname, 'src/islands/runtime.browser.tsx'),
        'manual-editor': path.resolve(__dirname, 'src/islands/ManualEditorIsland.tsx'),
        'smart-metadata': path.resolve(__dirname, 'src/islands/SmartMetadataIsland.tsx'),
        'feedback-controls': path.resolve(__dirname, 'src/islands/FeedbackControlsIsland.tsx'),
        'history-tabs': path.resolve(__dirname, 'src/islands/HistoryTabsIsland.tsx'),
        'history-manager': path.resolve(__dirname, 'src/islands/HistoryManagerIsland.tsx'),
        'overlay-viewer': path.resolve(__dirname, 'src/islands/OverlayViewerIsland.tsx'),
        'playground': path.resolve(__dirname, 'src/islands/PlaygroundIsland.tsx'),
        'visual-annotation': path.resolve(__dirname, 'src/islands/VisualAnnotationIsland.tsx'),
        'chat-workspace': path.resolve(__dirname, 'src/islands/ChatWorkspaceIsland.tsx'),
        'overview-dashboard': path.resolve(__dirname, 'src/islands/OverviewDashboardIsland.tsx'),
        'settings-sidebar': path.resolve(__dirname, 'src/islands/SettingsSidebarIsland.tsx'),
        'connection-settings': path.resolve(__dirname, 'src/islands/ConnectionSettingsIsland.tsx'),
        'ai-provider': path.resolve(__dirname, 'src/islands/AIProviderIsland.tsx'),
        'restart-banner': path.resolve(__dirname, 'src/islands/RestartBannerIsland.tsx'),
        'developer-settings': path.resolve(__dirname, 'src/islands/DeveloperSettingsIsland.tsx'),
        'presets-manager': path.resolve(__dirname, 'src/islands/PresetsManagerIsland.tsx'),
        'manual-workspace': path.resolve(__dirname, 'src/islands/ManualWorkspaceIsland.tsx'),
        'view-mode-toggle': path.resolve(__dirname, 'src/islands/ViewModeToggleIsland.tsx'),
        'document-content': path.resolve(__dirname, 'src/islands/DocumentContentIsland.tsx'),
        'visual-overlays': path.resolve(__dirname, 'src/islands/VisualOverlaysIsland.tsx'),
        'tags-manager': path.resolve(__dirname, 'src/islands/TagsManagerIsland.tsx'),
        'ai-analysis': path.resolve(__dirname, 'src/islands/AIAnalysisIsland.tsx'),
        'export-panel': path.resolve(__dirname, 'src/islands/ExportPanelIsland.tsx'),
        'resizable-layout': path.resolve(__dirname, 'src/islands/ResizableLayoutIsland.tsx')
      },
      formats: ['es'],
      fileName: (format, entryName) => {
        if (entryName === 'island-runtime') return 'island-runtime.js';
        return `${entryName}.island.js`;
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true
  }
});
