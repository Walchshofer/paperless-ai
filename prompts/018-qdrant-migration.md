---
name: qdrant-migration
stage: 020-schema
agent: schema-evolution
prompt_id: 018-native-alpha-9-vector-migration
---

<objective>
Migrate vector storage from PostgreSQL/pgVector to a Unified Qdrant (Alpha-9) 
stack. Establish the Hybrid SOT architecture to support 320-dim ColQwen3 
MaxSim retrieval and 384-dim Text RAG on the RTX 3090 Ti.
</objective>

<context>
We are deprecating pgVector to unlock the performance of the **Native Protocol Alpha-9**. 
This migration is a **BREAKING CHANGE** that establishes Qdrant as the primary 
Vector SOT, while PostgreSQL remains the Relational/Metadata SOT.

**Hardware Baseline:** RTX 3090 Ti (Ampere SM86).
**Critical Architecture:** Hybrid SOT with Payload Mirroring.
</context>

<requirements>
1. **Unified Qdrant Deployment**:
   - Add Qdrant to `docker-compose.yml`.
   - **Persistence:** Configure optimized volumes for fast NVMe I/O.
   - **Optimization:** Configure `mmap_threshold` for the RTX 3090 Ti profile.

2. **Distance Metric Lock (Critical)**:
   - `visual_pages`: Strictly **DOT** product (required for ColQwen3 MaxSim).
   - `visual_overlays`: Strictly **COSINE** (320-dim).
   - `document_embeddings`: Strictly **COSINE** (384-dim).
   - Implement a startup check to prevent initialization if metrics are mismatched.

3. **Hybrid SOT & Payload Mirroring**:
   - Implement "Expert Filtering" in both JS and Python adapters.
   - **Mirroring:** Every `upsert` must include `doc_id`, `correspondent_id`, 
     and `tag_ids` in the Qdrant Payload.
   - Create payload indexes for these fields in Qdrant.

4. **Adapter Refactoring (The Detox)**:
   - **Python:** `rag_service/qdrant_adapter.py` must follow **Flake8 (79-char)** and **Pylance typing** standards (use `typing.cast` for Qdrant models).
   - **JavaScript:** `services/visual-rag/QdrantAdapter.js` must implement 
     the Alpha-9 singleton pattern.

5. **Data Re-ingestion Strategy**:
   - Create `scripts/reingest_to_qdrant.js`.
   - **Logic:** Batch process from Paperless-ngx backup, generating 320-dim 
     embeddings via the sidecar and 384-dim text embeddings via Ollama.
   - Implement a "Verification Phase" that compares the first 10 MaxSim 
     scores against a known baseline.
</requirements>



<implementation>
- **Phase 1:** Deploy Qdrant and apply the **Distance Metric Lock**.
- **Phase 2:** Implement "Detoxed" adapters with Payload Mirroring.
- **Phase 3:** Execute re-ingestion script with hardware monitoring.
- **Phase 4:** Remove legacy `embedding` columns from PostgreSQL `visual_overlays`.
</implementation>

<output>
- `rag_service/qdrant_adapter.py` (Alpha-9 Compliant)
- `services/visual-rag/QdrantAdapter.js` (Alpha-9 Compliant)
- `migrations/005_remove_pgvector_columns.sql`
- `scripts/reingest_to_qdrant.js`
</output>

<verification>
- **Audit:** Run `node scripts/verify-qdrant-alpha9.js`.
- **Latency:** Confirm MaxSim search on `visual_pages` is < 200ms on RTX 3090 Ti.
- **Filtering:** Perform a vector search with a `correspondent_id` filter and 
  verify no results from other correspondents are returned.
- **Schema:** Confirm Postgres `visual_overlays` has 0 vector columns.
</verification>

<lifecycle>
1. Generate machine-readable summary: `prompts/summaries/018-qdrant-migration-summary.md`.
2. Update `docs/QDRANT_MIGRATION.md` with final collection UUIDs.
3. Move to `prompts/completed/`.
</lifecycle>