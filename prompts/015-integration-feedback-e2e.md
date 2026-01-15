---
name: integration-feedback-e2e
stage: 060-test
agent: test-agent
prompt_id: 015-native-alpha-9-feedback-loop
---

<objective>
Verify the full Native Protocol Alpha-9 feedback ingestion path. Validate that 
corrections from the Manual Editor persist to the PostgreSQL Hybrid SOT 
and trigger immediate Payload Mirroring in Qdrant for retrieval optimization.
</objective>

<context>
The feedback loop is the primary learning mechanism for the 320-dim 
ColQwen3 retriever. We must ensure that a user-corrected tag or correspondent 
is reflected in both the relational database and the vector store payload 
on the RTX 3090 Ti stack.

**Hardware Profile:** RTX 3090 Ti (Ampere SM86).
**Hybrid SOT:** Postgres (Relational) + Qdrant (Vector Payloads).

**Policy:** Read `docs/AGENT_READ_POLICY.md` to determine authoritative documentation.
</context>

<requirements>
1. **End-to-End User Flow (Playwright)**:
   - **Step 1:** Open a document in the Manual Editor.
   - **Step 2:** Change a field (e.g., Correspondent) and click "Confirm Match."
   - **Step 3:** Verify the UI displays a "Success" state with a Request ID.

2. **PostgreSQL Persistence Audit**:
   - Assert that a new row exists in `feedback_events`.
   - Fields: `doc_id`, `event_type='correction'`, `corrected_value`, 
     and `context.request_id`.

3. **Qdrant Payload Mirroring (Alpha-9 Requirement)**:
   - **Critical:** Query the Qdrant `visual_pages` collection for the same 
     `doc_id`.
   - Assert that the `payload` now contains the updated `correspondent_id`.
   - Verify this update happens within 2 seconds of the UI action.

4. **Telemetry & Sidecar Handshake**:
   - Verify `X-Request-Id` is propagated to the Paperless-ngx mock.
   - Assert `/metrics` increments `feedback_ingest_total` and 
     `qdrant_payload_sync_total`.

5. **"Detox" Standards Audit**:
   - Ensure the `feedback.flow.spec.ts` adheres to 79-character limits 
     in logic blocks and utilizes the shared `db-poll.js` helper.
</requirements>



<implementation>
- **E2E Tool:** Playwright + Node.js `assert`.
- **DB Helper:** `test/helpers/db-poll.js` (Wait for Postgres async writes).
- **Vector Helper:** `test/helpers/qdrant-poll.js` (Wait for payload sync).
- **Mocking:** Use an HTTP test double for Paperless-ngx to verify 
  metadata propagation.
</implementation>

<output>
- `test/e2e/feedback.flow.spec.ts`
- `test/helpers/qdrant-poll.js`
- `prompts/summaries/015-feedback-e2e-summary.md`
</output>

<verification>
- Run E2E Flow: `npm run test:e2e -- test/e2e/feedback.flow.spec.ts`.
- Manually inspect Qdrant WebUI (6333) to confirm payload mirroring.
- Verify `request_id` continuity across logs, Postgres, and Qdrant events.
</verification>

<lifecycle>
1. Generate machine-readable summary: `prompts/summaries/015-feedback-e2e-summary.md`.
2. Move to `prompts/completed/` after successful Hybrid SOT verification.
</lifecycle>