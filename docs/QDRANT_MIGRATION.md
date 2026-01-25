# Qdrant Migration Guide

## Overview

This document describes the migration from the current PostgreSQL/pgVector setup to Qdrant for vector storage. This is a **BREAKING CHANGE** that requires re-ingestion of all documents from the original paperless-ngx backup.

## Current Vector Store Architecture

### Collection Ownership & Separation
- **Text RAG**: dedicated collection `document_embeddings` (384 dimensions, **Cosine**). This collection stores document-level text embeddings used by `text-rag` services.
- **Visual RAG**: two dedicated collections:
  - `visual_pages` — multi-vector page embeddings (320 dimensions, **Dot**) used for ColQwen3 late-interaction / MaxSim scoring.
  - `visual_overlays` — overlay/region vectors (320 dimensions, **Cosine**) used for overlay retrieval and annotation. Payload mirroring is required: each point payload MUST include `doc_id`, `correspondent_id`, and `tag_ids`. The Postgres table `visual_overlays` holds a `vector_id` (UUID) that links to the corresponding Qdrant point.
- **Important:** These are **separate Qdrant collections** (not filters inside a single collection). Provision and validate them independently to enforce Distance Metric Locks and correct scoring semantics.

### 1. Text RAG Service - Python Service
- **Location**: `containers/text-rag/`
- **Vector Storage**: Qdrant (migrated from PostgreSQL + pgVector)
- **Collection**: `document_embeddings`
- **Embedding Model**: `paraphrase-multilingual-MiniLM-L12-v2` (384 dimensions)
- **Key Files**:
  - `containers/text-rag/data_manager.py` - Qdrant document embedding
  - `containers/text-rag/search_engine.py` - Semantic search using Qdrant
  - `containers/text-rag/state.py` - System status tracking
  - `containers/text-rag/qdrant_adapter.py` - Qdrant client adapter

### 2. Visual RAG Sidecar - Python Service
- **Location**: `containers/visual-rag/`
- **Vector Storage**: Qdrant (SOT), with local tensor cache (`.pt` files on disk)
- **Embedding Model**: `TomoroAI/tomoro-ai-colqwen3-embed-4b-awq` (320 dimensions, 4B-AWQ quantized)
- **Key Files**:
  - `containers/visual-rag/main.py` - Native ColQwen3 embeddings with MaxSim scoring (`processor.score_multi_vector`)
  - Stores embeddings as `.pt` files in `/data/indices/` (cache only)

#### Native Protocol Alpha-9 (Unified Qdrant + ColQwen3)
- **Summary**: A unified design where **Qdrant** is the persistent SOT for vectors and the **ColQwen3 sidecar** performs native late-interaction (MaxSim) scoring and local indexing. This is referred to in the repository as **Native Protocol Alpha-9**.
- **Hardware**: Optimized for **RTX 3090 Ti / Ampere SM86** (baseline optimized runtime memory profile ~3.5 GB for quantized 4B-AWQ workloads).
- **Page footprint**: Expect approximately **~840 KB per page** for 1,280 patches stored in bfloat16 multi-vector form (320-dim × 1280 × 2 bytes + payload overhead).
- **Guardrails**: Follow Schema Evolution guidance — **Distance Metric Locks** (enforce collection distance semantics) and **Payload Mirroring** (mirror minimal audit payload to PostgreSQL only when required).
- **Why native PyTorch MaxSim?** Late-interaction MaxSim scoring requires patch-wise cross-similarity computations that are inefficient and lossy to emulate with single-vector SQL similarity; computing MaxSim natively with `processor.score_multi_vector` in PyTorch preserves retrieval fidelity and enables optimized GPU-accelerated scoring.

### 3. Visual Overlay Repository - JavaScript Service
- **Location**: `services/visual-rag-client/`
- **Vector Storage**: Qdrant (migrated from PostgreSQL + pgVector)
- **Collection**: `visual_overlays`
- **Vector Dimensions**: 320
- **Key Files**:
  - `services/visual-rag-client/VisualOverlayRepository.js` - Overlay storage with vector search
  - `services/visual-rag-client/QdrantAdapter.js` - Qdrant client adapter for JavaScript
  - `services/visual-rag-client/IngestionManager.js` - Dual-path ingestion coordinator
  - `services/visual-rag-client/HybridSearchService.js` - RRF-based hybrid search

---

## Legacy ChromaDB References (To Remove)

### Files with ChromaDB References:

| File | Line | Context | Action Required |
|------|------|---------|-----------------|
| `.gitignore` | 23, 32, 33 | `/chromadb` directory exclusion | Keep (harmless) |
| `Dockerfile.rag` | 20 | `mkdir -p /app/data/chromadb` | **REMOVE** |
| `main.py` | 72 | `--rebuild-indexes` help text mentions "ChromaDB" | **UPDATE** |
| `services/visual-rag/migrate-legacy-docs.js` | 4 | Comment mentions "deprecated ChromaDB source location" | **UPDATE** |
| `docs/archive/V2_VISUAL_FIRST_RAG_GAP_AUDIT.md` | 35 | Historical reference | Keep (archive) |
| `services/prompts/MedicalPrompts.js` | 285 | False positive: "chromatin" (medical term) | No action |

### Cleanup Tasks:
1. Remove `mkdir -p /app/data/chromadb` from `Dockerfile.rag`
2. Update `main.py` help text to remove ChromaDB reference
3. Update `migrate-legacy-docs.js` comments to reflect Qdrant migration

---

## pgVector Dependencies (To Replace)

Policy: No backward compatibility layers to pgvector

- pgvector is deprecated and *must not* be included in runtime images or re-introduced as a compatibility fallback.
- Any PR that adds build-time or runtime support for pgvector (e.g., Dockerfiles that install `pgvector`, workflows that build/publish a `pgvector` Postgres image, or code paths that attempt to read/write `vector` columns) will be rejected by policy.
- A repository guard has been added (`.github/workflows/no-pgvector-guard.yml`) to block pushes/pull-requests that introduce forbidden pgvector artifacts.


### Python Dependencies (`requirements.txt`):
```
psycopg2-binary>=2.9.0  # PostgreSQL driver
```

### JavaScript Dependencies (`package.json`):
```json
"pg": "^8.16.3"  // PostgreSQL client
```

### Database Schema (Legacy pgvector-era - metadata only)

#### Legacy table: `document_embeddings` (RAGZ metadata only)
```sql
CREATE TABLE document_embeddings (
    id SERIAL PRIMARY KEY,
    doc_id INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    correspondent TEXT,
    created DATE,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Legacy table retained for metadata only. Embeddings live in Qdrant
-- `document_embeddings` (384D, Cosine). Do not add pgvector columns.
```

#### Legacy table: `visual_overlays` (metadata only)
```sql
CREATE TABLE visual_overlays (
    id SERIAL PRIMARY KEY,
    doc_id INTEGER NOT NULL,
    page_number INTEGER NOT NULL,
    overlay_data JSONB,
    semantic_label TEXT,
    enhanced_ocr_text TEXT,
    expert_metadata JSONB DEFAULT '{}',
    domain_view JSONB DEFAULT '{}',
    domain_signals JSONB DEFAULT '[]',
    retrieval_quality_score FLOAT DEFAULT 0.0,
    expert_routing_weights JSONB DEFAULT '{}',
    vector_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Legacy table retained for metadata only. Vectors live in Qdrant
-- `visual_overlays` (320D, Cosine). Do not add pgvector columns.
```

---

## Files Requiring Modification for Qdrant Migration

### High Priority (Core Vector Operations):

| File | Vector Operations | Migration Effort |
|------|-------------------|------------------|
| `containers/text-rag/data_manager.py` | `_ensure_qdrant_collection()`, `_add_documents_to_qdrant()` | High |
| `containers/text-rag/search_engine.py` | `semantic_search()`, `_qdrant_initialized()`, `validate_state()` | High |
| `containers/text-rag/state.py` | `qdrant_ready` status flag | Low |
| `services/visual-rag-client/VisualOverlayRepository.js` | `checkQdrantCollection()`, `searchByEmbedding()`, `ensureCollection()` | High |
| `containers/visual-rag/main.py` | Qdrant integration with local tensor cache | High |

### Medium Priority (Configuration & Status):

| File | Dependencies | Migration Effort |
|------|--------------|------------------|
| `containers/text-rag/settings.py` | No direct pgVector refs | None |
| `services/visual-rag-client/IngestionManager.js` | Uses VisualOverlayRepository | Low (indirect) |
| `services/visual-rag-client/HybridSearchService.js` | Uses text-rag service | Low (indirect) |
| `config/config.js` | Database config | Medium |

### Low Priority (Documentation & Scripts):

| File | Purpose | Action |
|------|---------|--------|
| `docs/RAG_SYSTEMS_REFERENCE.md` | Architecture docs | Update |
| `docs/DATABASE_SETUP.md` | Setup instructions | Rewrite |
| `docs/VISUAL_RAG_INTEGRATION.md` | Integration guide | Update |
| `migrations/*.sql` | Schema migrations | Archive |
| `scripts/check_pgvector.js` | Health check | Replace |
| `scripts/verify_visual_overlays_schema.js` | Schema verification | Replace |

---

## Qdrant Adapter Files

Qdrant adapter files for vector operations:
- `containers/text-rag/qdrant_adapter.py` - Python adapter for text embeddings
- `services/visual-rag-client/QdrantAdapter.js` - JavaScript adapter for visual overlays

---

## Migration Strategy

### Phase 1: Preparation

1. **Backup Original Documents**
   - Ensure all original PDFs/documents are backed up from paperless-ngx
   - These will be re-ingested after migration

2. **Deploy Qdrant**
   - Add Qdrant container to `docker-compose.yml`
   - Configure persistence volumes

3. **Implement Qdrant Adapters**
   - Complete `containers/text-rag/qdrant_adapter.py`
   - Complete `services/visual-rag-client/QdrantAdapter.js`

### Phase 2: Collection Schema

Create Qdrant collections with appropriate configuration:

#### Collection: `document_embeddings` (Text RAG)
```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

client = QdrantClient(host="qdrant", port=6333)

client.create_collection(
    collection_name="document_embeddings",
    vectors_config=VectorParams(size=384, distance=Distance.COSINE),
)
```

#### Collection: `visual_overlays` (Visual RAG)
```python
client.create_collection(
    collection_name="visual_overlays",
    vectors_config=VectorParams(size=320, distance=Distance.COSINE),
)
```

Important: For Native Protocol Alpha-9 we require **payload mirroring** of a minimal set of metadata to enable Expert Filtering and auditability. The Qdrant point payload for `visual_overlays` MUST include at least:
- `doc_id` (integer)
- `correspondent_id` (integer)
- `tag_ids` (array of integers)

Additionally, the relational `visual_overlays` table will hold a `vector_id` (UUID) column linking the visual overlay row to the Qdrant point. PostgreSQL MUST NOT store the embedding vector (no `embedding`/pgvector column) — Qdrant is the SOT for vectors.

The `visual_overlays` collection must be 320-dimensional and use **COSINE** distance; `visual_pages` must use **DOT** distance for page embeddings to remain compatible with ColQwen3 late-interaction scoring.

#### Collection: `visual_pages` (Visual RAG Sidecar)
```python
# Multi-vector support for ColQwen3 late-interaction
client.create_collection(
    collection_name="visual_pages",
    vectors_config={
        "page_embedding": VectorParams(size=320, distance=Distance.DOT)
    },
)
```

### Phase 3: Code Migration

1. **Python Text RAG Service**
   - Replace pgVector queries in `containers/text-rag/data_manager.py`
   - Replace pgVector queries in `containers/text-rag/search_engine.py`
   - Update status flags in `containers/text-rag/state.py`

2. **Visual RAG Sidecar**
   - Ensure Qdrant sync in `containers/visual-rag/main.py`
   - Keep local tensor cache for performance
   - Implement MaxSim scoring with Qdrant as SOT

3. **JavaScript Visual RAG Client**
   - Replace pg client with qdrant-js client in `services/visual-rag-client/`
   - Update VisualOverlayRepository methods

### Phase 4: Re-ingestion

1. **Clear Old Data**
   - Drop pgVector tables (or archive)
   - Clear Qdrant collections

2. **Re-ingest Documents**
   - Process all documents from paperless-ngx backup
   - Generate fresh embeddings with current models
   - Store in Qdrant

3. **Verify**
   - Test search functionality
   - Validate overlay extraction
   - Check hybrid search results

---

## Docker Compose Changes

Add Qdrant service:

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    container_name: paperless_qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_storage:/qdrant/storage
    environment:
      - QDRANT__STORAGE__ON_DISK_PAYLOAD=true
    restart: unless-stopped

volumes:
  qdrant_storage:
```

---

## Environment Variables

Add new variables:

```env
# Qdrant Configuration
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_API_KEY=  # Optional, for cloud deployments

# Feature Flags
VECTOR_STORE=qdrant  # Options: pgvector, qdrant
```

---

## Dependency Updates

### Python (`requirements.txt`):
```
# Remove or keep for metadata storage:
# psycopg2-binary>=2.9.0

# Add:
qdrant-client>=1.7.0
```

### JavaScript (`package.json`):
```json
{
  "dependencies": {
    "@qdrant/js-client-rest": "^1.7.0"
  }
}
```

### Visual RAG Sidecar (`containers/visual-rag/requirements.txt`):
```
# Add:
qdrant-client>=1.7.0
```

---

## Rollback Plan

1. Keep pgVector tables intact until migration is verified
2. Maintain feature flag for vector store selection
3. Document rollback procedure in runbook

---

## Post-Migration Cleanup

After successful migration and verification:

1. Remove pgVector extension usage (optional - may keep for metadata)
2. Archive old migration files
3. Update all documentation
4. Remove ChromaDB directory creation from Dockerfile.rag
5. Update CLAUDE.md with new architecture

---

## Testing Checklist

- [ ] Qdrant container starts successfully
- [ ] Collections created with correct schemas
- [ ] Document ingestion works (text embeddings)
- [ ] Visual RAG sidecar stores page embeddings
- [ ] Overlay extraction stores in Qdrant
- [ ] Text semantic search returns results
- [ ] Visual search returns results
- [ ] Hybrid search (RRF) works correctly
- [ ] Expert knowledge storage works
- [ ] Domain signal filtering works
- [ ] All existing tests pass

---

## References

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [qdrant-client Python](https://github.com/qdrant/qdrant-client)
- [qdrant-js JavaScript](https://github.com/qdrant/qdrant-js)
- Current architecture: `docs/RAG_SYSTEMS_REFERENCE.md`
- Visual RAG: `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md`
