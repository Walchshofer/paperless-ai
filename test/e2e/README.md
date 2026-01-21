# E2E Integration Tests

End-to-end tests for the Manual Route UI, Visual Annotation, Feedback System, and data persistence layers.

## Test Suites

### 1. Manual User Flow (`manual_user_flow.spec.ts`)

Complete user journey through the Manual Route UI:

- **GPU State Verification**: Tests GPU preparing modal, ready badge, and error states
- **Visual Annotation Island**: Tests draw toggle, annotation mode
- **Feedback Controls Island**: Tests thumbs up/down feedback interactions
- **Manual Editor Island**: Tests 4-tab interface (Metadata, Content, Fields, AI Debug)
- **Cross-Island Events**: Verifies `feedback:confirmed` and `payload:ready` event dispatch
- **Accessibility**: Tests ARIA attributes and keyboard navigation

### 2. PostgreSQL Persistence Audit (`postgres_persistence_audit.spec.ts`)

Verifies feedback events are correctly persisted to PostgreSQL:

- **Required Fields**: Validates `doc_id`, `event_type`, `field_name`, timestamps
- **JSONB Storage**: Tests complex nested structures, Unicode, special characters
- **Batch Atomicity**: Verifies multiple events persist atomically
- **Request ID Tracking**: Ensures `X-Request-Id` header flows through to database

### 3. Qdrant Payload Mirroring (`qdrant_payload_mirroring.spec.ts`)

Verifies payload synchronization between PostgreSQL and Qdrant:

- **Annotation Mirroring**: Tests bbox coordinates are stored in Qdrant
- **Payload Fields**: Verifies `doc_id`, `tag_ids`, `correspondent_id` are mirrored
- **Field Matching**: Compares Postgres rows with Qdrant point payloads
- **Visual Overlay Storage**: Tests normalized bbox [y1, x1, y2, x2] format

### 4. Telemetry & Sidecar Verification (`telemetry_sidecar_verification.spec.ts`)

Tests GPU sidecar handshake and observability:

- **Health Endpoint**: Tests 200 (ready), 503 (initializing), error states
- **Circuit Breaker**: Verifies circuit opens after repeated failures
- **Prometheus Metrics**: Checks for `visual_queries_executed_total`, `circuit_breaker_state`
- **GPU Warmup Flow**: Tests UI state during exponential backoff retries

### 5. Feedback Flow (`feedback.flow.spec.ts`)

Tests feedback submission workflow.

### 6. Manual Save Payload (`manual_save_payload.spec.ts`)

Tests manual document save operations.

### 7. Visual Annotation (`manual_visual_annotation.spec.ts`)

Tests visual annotation drawing and interactions.

## Running Tests

### Prerequisites

1. **Running Services**: Ensure all services are running via Docker Compose:
   ```bash
   docker-compose up -d
   ```

2. **Environment Variables**: Set required variables or use defaults:
   ```bash
   export PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
   export PROMETHEUS_METRICS_URL=http://127.0.0.1:9091/metrics
   export VISUAL_RAG_URL=http://127.0.0.1:8001
   export QDRANT_URL=http://127.0.0.1:6333
   export QDRANT_COLLECTION=visual_overlays
   export PAPERLESS_API_URL=http://127.0.0.1:8000/api
   export PAPERLESS_API_TOKEN=your-token
   export TEST_DOC_ID=1  # optional override for fixture selection
   export E2E_SKIP_FIXTURE_SETUP=false
   ```

   Fixture setup runs in Playwright global setup and writes
   `test/.auth/fixtures.json` with the resolved document id.

3. **Authentication** (if login required):
   ```bash
   export PAPERLESS_ADMIN_USER=admin
   export PAPERLESS_ADMIN_PASSWORD=password
   ```

### Running All E2E Tests

```bash
npm run verification:e2e
```

### Running Specific Test Suites

```bash
# Manual user flow only
npx playwright test manual_user_flow --config=test/playwright.config.ts

# Persistence tests
npx playwright test postgres_persistence --config=test/playwright.config.ts

# Qdrant mirroring tests
npx playwright test qdrant_payload --config=test/playwright.config.ts

# Telemetry tests
npx playwright test telemetry_sidecar --config=test/playwright.config.ts
```

### Running in UI Mode

```bash
npx playwright test --ui --config=test/playwright.config.ts
```

### Running with Debug

```bash
PWDEBUG=1 npx playwright test --config=test/playwright.config.ts
```

## Test Helpers

Located in `test/helpers/`:

### `db-poll.js`

```javascript
const { pollForFeedbackEvent, pollForRow, queryDb } = require('../helpers/db-poll');

// Poll for a feedback event
const row = await pollForFeedbackEvent(docId, 'correction', 10000);

// Generic row polling
const row = await pollForRow({
  sql: 'SELECT * FROM feedback_events WHERE doc_id = $1',
  params: [123],
  timeoutMs: 5000
});

// Direct query
const rows = await queryDb('SELECT * FROM feedback_events LIMIT 10');
```

### `qdrant-poll.js`

```javascript
const {
  pollForQdrantPoints,
  getPointsByDocId,
  verifyPayloadMirroring,
  collectionExists
} = require('../helpers/qdrant-poll');

// Check if collection exists
const exists = await collectionExists();

// Get points for a document
const points = await getPointsByDocId(123);

// Poll for points with timeout
const points = await pollForQdrantPoints(123, {
  timeoutMs: 15000,
  minCount: 1
});

// Verify Postgres row matches Qdrant payload
const result = verifyPayloadMirroring(pgRow, qdrantPoint);
console.log(result.mismatches);
```

### `metrics-snapshot.js`

```javascript
const { snapshotMetrics } = require('../helpers/metrics-snapshot');

const metricsText = await snapshotMetrics('http://127.0.0.1:9091/metrics');
const hasMetric = metricsText.includes('visual_queries_executed_total');
```

## Test Data IDs (data-testid)

### Visual Annotation Island
- `visual-annotation-island-root` - Root container
- `gpu-preparing-modal` - Full-page GPU warmup modal
- `gpu-error-modal` - Error state modal
- `gpu-ready-badge` - GPU ready indicator
- `draw-toggle` - Annotation mode toggle button
- `retry-button` - Retry connection button
- `retry-count` - Retry attempt counter

### Feedback Controls Island
- `feedback-controls-island-root` - Root container
- `thumbs-up-tags` - Tags approval button
- `thumbs-down-correspondent` - Correspondent rejection button

### Manual Editor Island
- `manual-editor-island-root` - Root container
- `tab-metadata` - Metadata tab button
- `tab-content` - Content tab button
- `tab-fields` - Fields tab button
- `tab-ai-debug` - AI Debug tab button
- `panel-metadata` - Metadata panel
- `panel-content` - Content panel
- `panel-fields` - Fields panel
- `panel-ai-debug` - AI Debug panel
- `manual-title-input` - Document title input
- `manual-save-btn` - Save button
- `add-field-btn` - Add custom field button
- `field-name-{index}` - Custom field name input
- `field-value-{index}` - Custom field value input
- `remove-field-{index}` - Remove field button

## Graceful Degradation

Tests are designed to skip gracefully when services are unavailable:

- **Qdrant unavailable**: Tests skip with message "Qdrant collection not available"
- **Sidecar initializing**: Tests accept 503 status as valid state
- **Feedback API errors**: Tests skip with "Feedback API not available"
- **Metrics not configured**: Tests log warning but don't fail
- **GPU not ready**: Tests verify error/preparing states instead

## Test Artifacts

After running tests, artifacts are available in:

- `test-results/playwright-report/` - HTML report
- `test-results/e2e-results.json` - JSON results
- `test-results/e2e-artifacts/` - Screenshots, videos, traces

## CI Integration

The tests are configured for CI environments:

```yaml
# Example GitHub Actions step
- name: Run E2E Tests
  run: npm run verification:e2e
  env:
    CI: true
    PLAYWRIGHT_BASE_URL: http://127.0.0.1:3000
```

CI-specific behavior:
- `retries: 2` - Retry failed tests twice
- `workers: 1` - Sequential test execution
- `forbidOnly: true` - Fail if test.only is present


