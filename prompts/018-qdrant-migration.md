<objective>
Migrate vector storage from PostgreSQL/pgVector to Qdrant for all RAG systems.
This is a **BREAKING CHANGE** requiring re-ingestion of all documents from the paperless-ngx backup.
</objective>

<context>
The project is migrating from pgVector (PostgreSQL extension) to Qdrant for vector storage to support:
- Visual RAG with ColQwen3 embeddings (320 dimensions)
- Text RAG with multilingual embeddings (384 dimensions)
- Better scalability and native multi-vector support

**Current State:**
- Text RAG (RAGZ): pgVector `document_embeddings` table (384-dim)
- Visual RAG Sidecar: In-memory tensors with `.pt` file persistence
- Visual Overlays: pgVector `visual_overlays.embedding` column (320-dim)

**Target State:**
- Text RAG: Qdrant `document_embeddings` collection (384-dim)
- Visual RAG Sidecar: Qdrant `visual_pages` collection (320-dim)
- Visual Overlays: Qdrant `visual_overlays` collection (320-dim)

**Pre-requisites:**
- Original documents backed up from paperless-ngx
- Qdrant container deployed

Reference docs:
- @paperless-ai/docs/QDRANT_MIGRATION.md (Authoritative migration guide)
- @paperless-ai/docs/RAG_SYSTEMS_REFERENCE.md
</context>

<requirements>
1. **Deploy Qdrant Container**:
   - Add Qdrant service to `docker-compose.yml` in paperless-ngx directory
   - Configure persistence volume for data
   - Expose ports 6333 (REST) and 6334 (gRPC)

2. **Implement JavaScript QdrantAdapter**:
   - Complete `services/visual-rag/QdrantAdapter.js`
   - Methods: `createCollection()`, `upsert()`, `search()`, `delete()`, `healthCheck()`
   - Use `@qdrant/js-client-rest` package

3. **Implement Python QdrantAdapter**:
   - Complete `rag_service/qdrant_adapter.py`
   - Methods: `create_collection()`, `upsert()`, `search()`, `delete()`, `health_check()`
   - Use `qdrant-client` package

4. **Update Visual RAG Sidecar**:
   - Modify `services/visual-rag-sidecar/main.py` to use Qdrant instead of tensor files
   - Store page embeddings in `visual_pages` collection
   - Implement MaxSim scoring via Qdrant

5. **Update RAGZ Service**:
   - Modify `rag_service/data_manager.py` to use QdrantAdapter
   - Modify `rag_service/search_engine.py` to query Qdrant
   - Update `rag_service/state.py` status flags

6. **Update VisualOverlayRepository**:
   - Modify `services/visual-rag/VisualOverlayRepository.js` to use QdrantAdapter
   - Remove pgVector-specific code
   - Keep PostgreSQL for metadata only

7. **Database Schema Migration**:
   - Create migration to remove `embedding` column from `visual_overlays` table
   - Archive old pgVector indexes
   - Update `document_embeddings` table to remove vector column

8. **Re-ingestion Script**:
   - Create `scripts/reingest_to_qdrant.js` for batch re-ingestion
   - Support `--dry-run`, `--batch-size`, `--verify` flags
   - Process documents from paperless-ngx backup

9. **Testing**:
   - Unit tests for QdrantAdapter (JS and Python)
   - Integration tests for collection creation and search
   - E2E test for full ingestion flow
</requirements>

<implementation>
- Phase 1: Deploy Qdrant, implement adapters (no data migration yet)
- Phase 2: Update services to use Qdrant adapters with feature flag
- Phase 3: Run re-ingestion from paperless-ngx backup
- Phase 4: Remove pgVector code and feature flag

**Qdrant Collections:**

```javascript
// document_embeddings (Text RAG - 384 dimensions)
{
  collection_name: "document_embeddings",
  vectors: { size: 384, distance: "Cosine" }
}

// visual_overlays (Visual RAG overlays - 320 dimensions)
{
  collection_name: "visual_overlays",
  vectors: { size: 320, distance: "Cosine" }
}

// visual_pages (Visual RAG sidecar - 320 dimensions)
{
  collection_name: "visual_pages",
  vectors: { size: 320, distance: "Dot" }
}
```

**Environment Variables:**
```env
QDRANT_HOST=qdrant
QDRANT_PORT=6333
VECTOR_STORE=qdrant  # Options: pgvector, qdrant
```
</implementation>

<output>
- `services/visual-rag/QdrantAdapter.js` (Implemented)
- `rag_service/qdrant_adapter.py` (Implemented)
- `services/visual-rag-sidecar/main.py` (Modified)
- `rag_service/data_manager.py` (Modified)
- `rag_service/search_engine.py` (Modified)
- `services/visual-rag/VisualOverlayRepository.js` (Modified)
- `migrations/005_remove_pgvector_columns.sql` (Created)
- `scripts/reingest_to_qdrant.js` (Created)
- `test/integration/qdrant-adapter.spec.js` (Created)
- `test/integration/qdrant-adapter.spec.py` (Created)
</output>

<verification>
- Qdrant container starts and `/health` returns 200
- Collections created with correct dimensions:
  - `document_embeddings`: 384-dim, cosine
  - `visual_overlays`: 320-dim, cosine
  - `visual_pages`: 320-dim, dot
- Unit tests pass for both JS and Python adapters
- Re-ingestion script processes documents without errors
- Text search returns results from Qdrant
- Visual search returns results from Qdrant
- Hybrid search (RRF) works with Qdrant backend
- PostgreSQL tables retain metadata but no vector columns
</verification>

<lifecycle>
1. Upon completion, generate summary: `prompts/summaries/018-qdrant-migration-summary.md`
2. Update `docs/RAG_SYSTEMS_REFERENCE.md` to reflect Qdrant architecture
3. Update `docs/DATABASE_SETUP.md` with Qdrant setup instructions
4. Archive pgVector-related migrations
5. Move this prompt to `prompts/completed/018-qdrant-migration.md`
</lifecycle>
