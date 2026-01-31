import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@test': path.resolve(__dirname, './test'),
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsxInject: `import { h, Fragment } from 'preact'`,
  },
  test: {
    // Only include TypeScript test files to avoid picking up legacy Mocha .js tests
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts', 'test/**/*.spec.tsx', 'src/**/__tests__/**/*.{test,spec}.ts?(x)'],
    exclude: ['**/*.js', 'test/e2e/**'],
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
});