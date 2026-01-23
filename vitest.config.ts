import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only include TypeScript test files to avoid picking up legacy Mocha .js tests
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts', 'src/**/__tests__/**/*.{test,spec}.ts?(x)'],
    exclude: ['**/*.js', 'test/e2e/**'],
    environment: 'jsdom',
    globals: true,
  },
});