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
        'island-runtime': path.resolve(__dirname, 'src/islands/runtime.browser.tsx'),
        'manual-editor': path.resolve(__dirname, 'src/islands/ManualEditorIsland.tsx'),
        'feedback-controls': path.resolve(__dirname, 'src/islands/FeedbackControlsIsland.tsx'),
        'history-tabs': path.resolve(__dirname, 'src/islands/HistoryTabsIsland.tsx'),
        'overlay-viewer': path.resolve(__dirname, 'src/islands/OverlayViewerIsland.tsx'),
        'playground': path.resolve(__dirname, 'src/islands/PlaygroundIsland.tsx'),
        'visual-annotation': path.resolve(__dirname, 'src/islands/VisualAnnotationIsland.tsx'),
        'overview-dashboard': path.resolve(__dirname, 'src/islands/OverviewDashboardIsland.tsx'),
        'settings-sidebar': path.resolve(__dirname, 'src/islands/SettingsSidebarIsland.tsx'),
        'connection-settings': path.resolve(__dirname, 'src/islands/ConnectionSettingsIsland.tsx'),
        'ai-provider': path.resolve(__dirname, 'src/islands/AIProviderIsland.tsx'),
        'expert-models': path.resolve(__dirname, 'src/islands/ExpertModelsIsland.tsx'),
        'restart-banner': path.resolve(__dirname, 'src/islands/RestartBannerIsland.tsx'),
        'developer-settings': path.resolve(__dirname, 'src/islands/DeveloperSettingsIsland.tsx'),
        'presets-manager': path.resolve(__dirname, 'src/islands/PresetsManagerIsland.tsx')
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
