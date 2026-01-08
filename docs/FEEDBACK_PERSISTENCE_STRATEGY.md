# Feedback Persistence Strategy

## Objective

To capture, store, and utilize human feedback (corrections, annotations, verifications) so Paperless-AI can improve over time through the Bias Engine and Visual RAG loop.

## Overview

- Move feedback from file-based JSON to a PostgreSQL `feedback_events` table (UUID-based PK recommended).
- Collect value corrections, visual annotations, and implicit verifications.
- Provide internal endpoints for the Bias Engine to fetch unprocessed events and mark them processed.

## Data Flow

1. **User Action**: User edits a document in the `manual` or `history` route (e.g., corrects OCR, updates Title, modifies Tags, draws bounding box).
2. **Submission**: Client POSTs feedback to `POST /api/feedback`.
3. **App Action**: Service updates Paperless-NGX document metadata (so UI reflects change) and persists the feedback event in `feedback_events`.
4. **Learning (Async)**: Bias Engine / periodic jobs consume unprocessed events, update Logit Bias, few-shot examples, and visual overlays, then mark events processed.

## Database Schema (recommended)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id INT NOT NULL, -- FK to the Paperless document id
  user_id INT, -- Optional
  event_type VARCHAR(50) NOT NULL, -- e.g., 'correction', 'annotation', 'verification', etc.
  field_name VARCHAR(100), -- e.g., 'total_amount', 'title', 'custom_field_X'
  original_value JSONB,
  corrected_value JSONB,
  context JSONB, -- e.g., { bbox, page_number, surrounding_text, model_version }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_feedback_doc_id ON feedback_events(doc_id);
CREATE INDEX idx_feedback_processed_false ON feedback_events(created_at) WHERE processed = FALSE;
CREATE INDEX idx_feedback_event_type ON feedback_events(event_type);
```

## Feedback Types & Examples

- Value Correction:

```json
{ "type": "correction", "field": "total_amount", "original": "100.00", "corrected": "105.00" }
```

- Visual Annotation (Red Pen):

```json
{ "type":"annotation", "field":"handwritten_note", "corrected":"Paid via Check #123", "context": {"bbox":[100,200,300,50], "page":1} }
```

- Implicit Verification:

```json
{ "type":"verification", "field":"all", "corrected":null }
```

## Integration with Learning Loop

- **Logit Bias**: Aggregate recurring corrections (frequent correspondents, recurring titles/tags) and update LLM logit bias configurations.
- **Visual RAG**: Flagged bounding boxes become "gold" overlays to prioritize retrieval and re-embedding; these can be used as ground-truth for region-level retrieval.
- **Periodic Jobs**: Analyze `feedback_events` to create artifacts for training or retrieval (e.g., candidate logit biases, few-shot examples, overlay gold records).

## API Endpoints (recommended)

- `POST /api/feedback` — Public/user endpoint to record a feedback event (validates input, updates Paperless-NGX metadata when applicable, inserts a `feedback_events` row).
- `GET /api/feedback/pending` — Internal: list unprocessed events for the Bias Engine (require service auth).
- `POST /api/feedback/process` — Internal: mark events processed (require service auth).

All endpoints must include request-id telemetry and be access-controlled (internal endpoints require service-level auth).

## Migration & Implementation Plan

1. Add migration `migrations/002_create_feedback_events.sql` with the schema above.
2. Add model `models/feedback.js` with insertion and query helpers (or use `services/documentModel.js` helpers).
3. Add routes/service `routes/feedback.js` or `services/feedback.js` (POST `/api/feedback`, internal endpoints).
4. Add a Bias Engine job to consume unprocessed events and mark them processed.
5. Add unit + integration tests (Mocha + Node assert) and telemetry entries.

## Security & Privacy

- Feedback may contain PII; restrict DB access and limit logging of sensitive fields.
- Retention policy: configurable via env var; default keep for at least 90 days or until processed.
- Ensure data-handling follows GDPR and company policies (provide deletion/retention controls as required).

## Observability & Tests

- Emit telemetry: `feedback_ingest`, `feedback_processing`, `bias_engine_updates` (include request-id and event counts).
- Tests: unit tests for route validation and model insertion; integration test for migration + insert + processing.

## Notes & Recommendations

- Prefer UUID primary key for distributed safety and to avoid leaking monotonic IDs.
- Ensure naming consistency: use `doc_id` to match existing Paperless-NGX conventions if applicable.
- Document the endpoints and process in `docs/EXPERT_PIPELINE_DECISION_TABLE.md` if pipeline or contract changes are needed.

---

*Document merged and standardized from previous drafts. If this looks good, I will add the migration, model, routes, tests, and remove `docs/FEEDBACK_PERSITANCE_STRATEGY.md`.*