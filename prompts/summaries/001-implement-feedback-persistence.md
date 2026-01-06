# 001 — Implement Feedback Persistence (Summary)

**Prompt:** `prompts/001-implement-feedback-persistence.md`
**Created:** 2026-01-07
**Author:** GitHub Copilot

---

## Objective ✅
Implement backend persistence for granular user feedback and visual annotations using PostgreSQL + pgvector so that the system can store field-level corrections and manual bounding-box annotations for future learning and retrieval workflows.

## Implementation artifacts 🔧
- migrations/002_create_feedback_events.sql — Created (adds `feedback_events` table; ensures `visual_overlays` has `source` and `bbox`).
- migrations/002_rollback_feedback_events.sql — Created (rollback of `feedback_events`).
- services/feedback/FeedbackService.js — Modified: added `recordGranularFeedback(documentId, events, options)` with transactional and best-effort modes; embedding fallback and runtime vector-dimension adaptation; improved client handling and retry on aborted pooled clients.
- routes/api/visual-rag.js — Contains `POST /api/visual-rag/feedback` route that validates payload and delegates to FeedbackService.
- test/feedback_persistence.test.js — Added/updated tests for insertion, embedding persistence, and transactional rollback; includes a standalone migration step for its test pool.

## Key behaviors & design notes 🧠
- Embedding: prefers `ragService.embed()` (best-effort); falls back to deterministic 320-d `computeSimpleEmbedding()`.
- Runtime adaptation: on pgvector dimension mismatch, pads/truncates and retries the overlay insert.
- Transaction semantics: `options.transactional === true` → throw on failure (strict); otherwise return `{ errors: [...] }` (best-effort).
- Pool/testability: `recordGranularFeedback` accepts `options.pool` / `options.client` to support test isolation.
- Robustness: detects aborted pooled-client transactions, destroys bad client, and retries once.
- Telemetry: records `feedback_ingest` latency via metricsCollector; structured logs include `requestId` and errors.

## Verification status & test results ⚠️
- Migration applied successfully in CI/local run (repository pool). 
- Test run: `npm test test/feedback_persistence.test.js` → **332 passing, 2 failing**.
  - Failing tests:
    1. `should store embedding on manual annotation and rollback on transactional error` — assertion failed: no `feedback_event` inserted in the standalone test (likely pool mismatch or migration context issue).
    2. `should insert granular feedback and visual overlays in a transaction` — intermittent `current transaction is aborted, commands ignored until end of transaction block` error (aborted pooled client behavior; retry/destroy logic added but still reproduces in one case).

## Recommended next steps ▶️
1. Run the focused failing tests with debugging logs enabled and confirm the pool used by the standalone test is passed into `recordGranularFeedback` (change already added). If failing, capture SQL and client state.
2. Add a telemetry increment and debug log when vector-dimension adaptation happens (counts and sizes) to help identify mismatches in CI.
3. Add a short unit/integration test to simulate an aborted pooled client and validate retry logic destroys and replaces the client.
4. After fixes, re-run full test suite and move this prompt to `prompts/completed/` and save final summary in `prompts/summaries/`.

## Related docs & references 📚
- docs/FEEDBACK_PERSISTENCE_STRATEGY.md — authoritative schema & guidance
- prompts/README.md — prompts lifecycle (summaries folder mandated)
- prompts/EXECUTION_ORDER.md — execution dependency graph (Phase 1)

## Checklist ✅/❗
- [x] Migration file added
- [x] Rollback added
- [x] FeedbackService implemented
- [x] Route implemented
- [x] Tests added
- [ ] Fix failing tests (2 failing) — IN PROGRESS
- [ ] Add dimension-adaptation metric & extra logs — RECOMMENDED

---

*If you want this saved in a different format (JSON or a compact one-line metadata file), tell me and I’ll add it.*
