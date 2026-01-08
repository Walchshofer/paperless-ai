import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  css: {
    modules: {
      scopeBehaviour: 'local',
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[name]__[local]___[hash:base64:5]'
    }
  },
  build: {
    lib: {
      entry: {
        'island-runtime': path.resolve(__dirname, 'src/islands/runtime.js'),
        'manual-editor': path.resolve(__dirname, 'src/islands/ManualEditorIsland.tsx'),
        'feedback-controls': path.resolve(__dirname, 'src/islands/FeedbackControlsIsland.tsx')
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.island.js`
    }
  }
});
