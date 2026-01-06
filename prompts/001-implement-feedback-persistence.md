<objective>
Implement the backend persistence layer for granular user feedback and visual annotations using PostgreSQL and pgvector.
This is Phase 1 of the Manual Route UI Enhancement Plan.
</objective>

<context>
The project is upgrading its feedback system from simple document-level ratings to granular, field-level feedback (e.g., specific tags, custom fields) and visual annotations (bounding boxes).
This data will be stored in PostgreSQL to enable future Reinforcement Learning (RLHF) and logit bias optimization.
Current state:
- `FeedbackService.js` exists but only handles document-level ratings.
- `visual_overlays` table exists (for RAG) but needs to support manual user annotations.
- `feedback_events` table does NOT exist.
Reference docs:
- @paperless-ai/docs/FEEDBACK_PERSISTENCE_STRATEGY.md (Authoritative schema)
- @prompts/planning/MANUAL-ROUTE-UI-ENHANCEMENT-PLAN.md
</context>

<requirements>
1. **Database Migration**:
   - Create a migration file in `paperless-ai/migrations/` to create the `feedback_events` table.
   - Schema must match `FEEDBACK_PERSISTENCE_STRATEGY.md` exactly (UUID id, JSONB values, correct foreign keys).
   - Ensure `visual_overlays` table supports `source='manual'` and `bbox` columns (check existing schema first).

2. **Enhance FeedbackService**:
   - Modify @paperless-ai/services/feedback/FeedbackService.js.
   - Add method `recordGranularFeedback(documentId, feedbackData)` that handles the transaction.
   - Logic:
     - Start Transaction.
     - If `visual_annotation` is present: Generate embedding (using `ragService` or similar) and insert into `visual_overlays`.
     - Insert field-level feedback items into `feedback_events`.
     - Commit Transaction.

3. **API Endpoint**:
   - Implement `POST /api/visual-rag/feedback` in @paperless-ai/routes/api/visual-rag.js (create if missing, or add to existing).
   - Validation: Ensure payload matches the expected structure in the Plan.
   - Delegate logic to `FeedbackService`.

4. **Testing**:
   - Create a test file `paperless-ai/test/feedback_persistence.test.js` to verify:
     - `feedback_events` insertion.
     - `visual_overlays` insertion with embeddings.
     - Transaction rollback on failure.
</requirements>

<implementation>
- Use `pg` client for database interactions.
- Reuse existing service patterns (e.g., `db.query`, transaction helpers if available).
- Ensure strictly typed JSONB handling.
</implementation>

<output>
- `./paperless-ai/migrations/002_create_feedback_events.sql` (Created/Modified)
- `./paperless-ai/migrations/002_rollback_feedback_events.sql` (Created - rollback script)
- `./paperless-ai/services/feedback/FeedbackService.js` (Modified)
- `./paperless-ai/routes/api/visual-rag.js` (Modified/Created)
- `./paperless-ai/test/feedback_persistence.test.js` (Created)
</output>

<verification>
- Run the migration.
- Run the new test: `npm test test/feedback_persistence.test.js`
- Verify database tables have the correct columns.
- Verify telemetry and metrics: send a sample feedback payload and confirm `feedback_ingest` logs include `request_id` and that Prometheus metrics capture a `pipeline_stage_latency` for `feedback_ingest`.
</verification>


### Error Handling Strategy
- **Default (recommended):** Best-effort persistence. The Paperless update is the primary success criteria; feedback recording is attempted and failures are logged and emitted as telemetry (integration errors).
- **Transactional (opt-in):** If the orchestrator sets `transactional: true`, feedback persistence MUST succeed before Paperless update proceeds; any failure should abort the operation and return an error to the caller. This mode is for controlled scenarios only and should be used cautiously.

### Telemetry & Structured Logging
- Include `request_id` (from `X-Request-Id` or generated server-side) on all feedback-related logs.
- Emit Prometheus metrics for `feedback_ingest` duration (use `metricsCollector.recordStageLatency('feedback_ingest', 'integration', durationMs)`) and increment `integration_errors_total` on failures.

