---
name: verification-db-schema
stage: 020-schema
agent: schema-evolution
prompt_id: 011-native-alpha-9-sot-verification
---

# Verification: Hybrid SOT (Postgres + Qdrant)

**PROTOCOL UPGRADE (Alpha-9):** This verification ensures the Hybrid SOT 
synchronization between PostgreSQL (Relational/RLHF) and Qdrant (Vectors).

<objective>
Validate the structural integrity of the Native Protocol Alpha-9 storage layer:
1. PostgreSQL metadata tables (feedback_events, visual_overlays).
2. Qdrant Unified Collections (320D/384D).
3. Payload Mirroring consistency (Postgres filters exist in Qdrant).
</objective>

<context>
The **Hybrid SOT** architecture is mandatory for the RTX 3090 Ti stack. 
Retaining embeddings in PostgreSQL is deprecated.
- **Postgres:** SOT for Document IDs, Metadata, and RLHF Feedback.
- **Qdrant:** SOT for Late Interaction (MaxSim) and Vector Retrieval.

**References:**
- docs/QDRANT_MIGRATION.md
- docs/FEEDBACK_PERSISTENCE_STRATEGY.md
- docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md
</context>

<requirements>
1. **PostgreSQL Guardrails**:
   - Verify `pgcrypto` is present for UUID generation.
   - Confirm `visual_overlays` and `feedback_events` tables exist.
   - **Critical:** Confirm NO `vector` or `embedding` columns exist in Postgres 
     (prevents VRAM-wasting duplicate storage).

2. **Qdrant Collection Audit (Alpha-9 Specs)**:
   - `document_embeddings`: 384-dim, Cosine (MiniLM-L12).
   - `visual_overlays`: 320-dim, Cosine (ColQwen3 Overlay).
   - `visual_pages`: 320-dim, Dot Product (ColQwen3 Retrieval).
   - **Metric Lock:** Verify distance metrics match exactly; mismatches 
     invalidate ColQwen3 MaxSim scoring.

3. **Payload Mirroring Validation**:
   - Ensure Qdrant payloads contain: `doc_id`, `correspondent_id`, `tag_ids`.
   - Verify that payload fields are indexed for fast "Expert Filtering."
</requirements>



<implementation>
- **Postgres Check:** Create `scripts/verify-postgres-detox.js`.
- **Qdrant Check:** Create `scripts/verify-qdrant-alpha9.js`.
- **Test Suite:** `test/integration/hybrid-sot-sync.spec.js`.
- **Logic:** The suite must attempt to insert a row in Postgres and a 
  corresponding vector in Qdrant, then perform a "Filtered Vector Search" 
  to confirm the link is active.
</implementation>

<output>
- `scripts/verify-postgres-detox.js`
- `scripts/verify-qdrant-alpha9.js`
- `test/integration/hybrid-sot-sync.spec.js`
- `prompts/summaries/011-db-schema-verification-summary.md`
</output>

<verification>
- Run Postgres Audit: `node scripts/verify-postgres-detox.js`.
- Run Qdrant Audit: `node scripts/verify-qdrant-alpha9.js`.
- Run Sync Test: `npm test test/integration/hybrid-sot-sync.spec.js`.
- **Criteria:** All distance metrics must match; 0 vector columns in Postgres.
</verification>

<lifecycle>
1. Generate machine-readable summary: `prompts/summaries/011-db-schema-verification-summary.md`.
2. Move to `prompts/completed/` after successful SOT validation.
</lifecycle>