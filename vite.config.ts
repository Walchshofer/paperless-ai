import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
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
        'visual-annotation': path.resolve(__dirname, 'src/islands/VisualAnnotationIsland.tsx')
      },
      formats: ['es'],
      fileName: (format, entryName) => {
        if (entryName === 'island-runtime') return 'island-runtime.js';
        return `${entryName}.island.js`;
      }
    }
  }
});
