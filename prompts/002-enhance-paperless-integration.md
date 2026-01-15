---
name: enhance-paperless-integration
stage: 080-paperless-api
agent: paperless-api-expert
prompt_id: 002-native-alpha-9-metadata-sync
---

<objective>
Enhance PaperlessService to support Custom Fields and implement the 
Manual Update Orchestrator. Ensure metadata consistency between 
Paperless-ngx (Primary SOT) and the Qdrant Vector Store (Alpha-9 Retrieval SOT).
</objective>

<context>
The Manual Route allows users to edit metadata. Under the Native Protocol 
Alpha-9, any change to a document's Correspondent, Tags, or Date must be 
mirrored into the Qdrant Vector Payload to maintain retrieval integrity.

**Hardware Profile:** RTX 3090 Ti (Ampere SM86).
**Hybrid SOT:** Paperless-ngx (Relational) + Qdrant (Vector Payloads).

**Policy:** Read `docs/AGENT_READ_POLICY.md` to determine authoritative documentation.
</context>

<requirements>
1. **PaperlessService Upgrade (V9 API)**:
   - Restore and fix `custom_fields` handling in `updateDocument`.
   - **Protocol:** Ensure incoming `custom_fields` are normalized to 
     `{field: id, value: value}`.
   - **Reliability:** Implement the `DELETE` then `PATCH` pattern to ensure 
     idempotency when updating custom field values in Paperless-ngx.

2. **Orchestrator Route & Hybrid Sync**:
   - Refactor `POST /manual/updateDocument`.
   - **Step 1:** Update Paperless-ngx via `PaperlessService.updateDocument`.
   - **Step 2:** Persist the correction to PostgreSQL `feedback_events`.
   - **Step 3 (Critical):** If Tags or Correspondent changed, trigger an 
     asynchronous payload update in Qdrant via `QdrantAdapter.js`. This 
     ensures "Expert Filtering" remains synchronized.

3. **Error Handling & Telemetry**:
   - **Best-Effort Logic:** Paperless-ngx update is the primary success flag. 
     Log failures in the feedback or Qdrant sync paths as integration errors.
   - Propagate `X-Request-Id` to all downstream service calls.
   - Emit Prometheus metric `qdrant_payload_sync_total` on success.

4. **"Detox" Standards**:
   - Ensure the orchestrator logic is clean and adheres to the project's 
     strict typing and maintenance standards.
</requirements>



<implementation>
- **Orchestrator:** Use the existing `FeedbackService` and `QdrantAdapter` 
  singletons.
- **Diffing:** Only trigger a Qdrant sync if the metadata fields involved in 
  filtering (Tags, Correspondent) have actually changed.
- **Validation:** Use `paperless-api-expert` to verify the JSON payloads 
  match the Paperless-ngx v9 contract.
</implementation>

<output>
- `services/paperlessService.js` (Modified)
- `routes/manual.js` (Orchestrator implemented)
- `test/manual_orchestration.test.js` (Created)
</output>

<verification>
- **Manual Sync:** Update a document's Correspondent in the UI. 
- **Check 1:** Verify the change appears in Paperless-ngx.
- **Check 2:** Verify a row is added to `feedback_events` in Postgres.
- **Check 3:** Verify the Qdrant payload for that `doc_id` contains the 
  new `correspondent_id`.
- **Latency:** Ensure the entire orchestration loop completes < 500ms.
</verification>

<lifecycle>
1. Generate machine-readable summary: `prompts/summaries/002-paperless-integration-summary.md`.
2. Update `docs/DATABASE_SETUP.md` if new sync-failure states are added.
3. Move to `prompts/completed/`.
</lifecycle>