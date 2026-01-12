---
name: implement-feedback-persistence
stage: 020-schema
agent: schema-evolution
prompt_id: 001-native-alpha-9-feedback-sot
---

<objective>
Implement the Native Protocol Alpha-9 persistence layer. This establishes the 
Hybrid SOT (Source of Truth): PostgreSQL for relational metadata/RLHF and 
Qdrant for 320-dim ColQwen3 vector storage.
</objective>

<context>
The project is moving to a strict Hybrid SOT architecture. We must ensure 
that user feedback (bounding boxes, field corrections) is synchronized across 
relational and vector stores while respecting the RTX 3090 Ti baseline.

**Hardware Baseline:** RTX 3090 Ti (Ampere SM86).
**Vector Goal:** ColQwen3-compatible MaxSim retrieval.
</context>

<requirements>
1. **PostgreSQL Schema (The Detox)**:
   - Create `migrations/002_create_feedback_events.sql`.
   - Table `feedback_events`: UUID primary key, JSONB for `corrected_value`.
   - **Critical:** Ensure `visual_overlays` table has NO `embedding` column. 
     PostgreSQL stores only metadata (bbox, label, doc_id).
   - Add `vector_id` (UUID) to `visual_overlays` to link to Qdrant.

2. **Qdrant Collection Lock (Alpha-9 Standard)**:
   - Initialize the `visual_overlays` collection in Qdrant via `QdrantAdapter.js`.
   - **Distance Metric Lock:** Strictly **COSINE** for overlays; **DOT** for pages.
   - **Dimensions:** Strictly **320** (ColQwen3 native).

3. **Enhance FeedbackService (Hybrid SOT Logic)**:
   - Method `recordGranularFeedback(documentId, feedbackData)`:
     - **Relational:** Insert event into PostgreSQL `feedback_events`.
     - **Vector:** If a bounding box is present, trigger sidecar embedding 
       and `upsert` to Qdrant.
     - **Payload Mirroring:** Mirror `correspondent_id` and `tag_ids` from 
       Postgres into the Qdrant payload to enable "Expert Filtering."

4. **API and Handshake**:
   - Implement `POST /api/visual-rag/feedback`.
   - Handle the **503 Initializing** handshake: If the sidecar is warming 
     up the model on the RTX 3090 Ti, the service must retry or log a 
     deferred ingestion event.

5. **Telemetry & "Detox" Compliance**:
   - Every log must include `request_id` and `hardware_target: "RTX 3090 Ti"`.
   - Python-side code in adapters must adhere to the 79-character Flake8 limit.
</requirements>



<implementation>
- **JS side:** Use `pg` for metadata and `@qdrant/js-client-rest` for vectors.
- **Python side:** Ensure `rag_service/qdrant_adapter.py` is synchronized.
- **Transactionality:** Follow "Best-effort" persistence for feedback, 
  ensuring the document update in Paperless-ngx remains the primary success flag.
</implementation>

<output>
- `migrations/002_create_feedback_events.sql`
- `services/feedback/FeedbackService.js` (Modified for Hybrid SOT)
- `services/visual-rag/QdrantAdapter.js` (Alpha-9 Compliant)
</output>

<verification>
- Run migration and confirm PostgreSQL schema contains 0 vector columns.
- Run `test/feedback_persistence.test.js` and verify mirroring:
  - Check Postgres for the `feedback_event`.
  - Check Qdrant for the `vector` with correct `correspondent_id` in payload.
- Verify VRAM usage on the RTX 3090 Ti remains stable (~3.5GB baseline).
</verification>

<lifecycle>
1. Generate machine-readable summary: `prompts/summaries/001-feedback-persistence-summary.md`.
2. Update `docs/QDRANT_MIGRATION.md` with the new payload mirroring schema.
3. Move to `prompts/completed/`.
</lifecycle>