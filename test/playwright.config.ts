import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for E2E Tests
 *
 * Test Suites:
 * - manual_user_flow.spec.ts: Complete UI user flow through Manual Route
 * - postgres_persistence_audit.spec.ts: PostgreSQL feedback event persistence
 * - qdrant_payload_mirroring.spec.ts: Qdrant vector store payload sync
 * - telemetry_sidecar_verification.spec.ts: GPU sidecar handshake and metrics
 * - feedback.flow.spec.ts: Feedback submission flow
 * - manual_save_payload.spec.ts: Manual save operations
 * - manual_visual_annotation.spec.ts: Visual annotation interactions
 *
 * Environment Variables:
 * - PLAYWRIGHT_BASE_URL: Base URL for tests (default: http://localhost:3000)
 * - PROMETHEUS_METRICS_URL: Prometheus endpoint (default: http://localhost:9091/metrics)
 * - VISUAL_RAG_URL: Visual RAG sidecar URL (default: http://localhost:8001)
 * - QDRANT_URL: Qdrant vector store URL (default: http://localhost:6333)
 * - QDRANT_COLLECTION: Qdrant collection name (default: visual_overlays)
 * - TEST_DOC_ID: Document ID for testing (default: 1)
 * - PAPERLESS_ADMIN_USER: Admin username for login
 * - PAPERLESS_ADMIN_PASSWORD: Admin password for login
 */

export default defineConfig({
  testDir: './e2e',

  // Only match TypeScript Playwright tests (exclude legacy Mocha .spec.js files)
  testMatch: '**/*.spec.ts',

  // Global timeout for each test
  timeout: 60_000,

  // Expect timeout for assertions
  expect: {
    timeout: 10_000,
  },

  // Run tests in parallel within files
  fullyParallel: false,

  // Fail the build on CI if test.only was left in
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,

  // Limit parallel workers on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { open: 'never', outputFolder: '../test-results/playwright-report' }],
    ['json', { outputFile: '../test-results/e2e-results.json' }],
    ['list'],
  ],

  // Shared settings for all projects
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    headless: true,

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Capture trace on failure for debugging
    trace: 'on-first-retry',

    // Video recording
    video: 'on-first-retry',

    // Navigation timeout
    navigationTimeout: 15_000,

    // Action timeout
    actionTimeout: 10_000,
  },

  // Test projects for different scenarios
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Optionally add Firefox and WebKit for cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Output directory for test artifacts
  outputDir: '../test-results/e2e-artifacts',

  // Web server to start before running tests (optional - use if running locally)
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
