# Database Setup Guide (Qdrant + PostgreSQL)

## Overview

Paperless-AI uses a hybrid database architecture:

- **Qdrant** (Vector Storage): All embedding vectors for RAG operations
  - `document_embeddings` collection (384D, Cosine) - Text RAG
  - `visual_overlays` collection (320D, Cosine) - Visual overlay embeddings
  - `visual_pages` collection (320D, Dot) - Visual RAG sidecar

- **PostgreSQL** (Metadata Storage): Document metadata, overlay info, feedback events
  - `visual_overlays` table (metadata only, no embedding column)
  - `feedback_events` table
  - Other application tables

This guide covers setup, troubleshooting, and common issues.

> **Migration Note**: pgVector is deprecated. See `docs/QDRANT_MIGRATION.md` for migration instructions.

## Requirements

### Qdrant (Vector Storage)
- **Qdrant Version:** 1.7.0+
- **Docker Image:** `qdrant/qdrant:latest`
- **Ports:** 6333 (HTTP API), 6334 (gRPC)
- **Storage:** Persistent volume for `/qdrant/storage`

### PostgreSQL (Metadata Storage)
- **PostgreSQL Version:** 16+
- **Docker Image:** `postgres:16` (pgvector no longer required for new deployments)
- **Legacy:** `pgvector/pgvector:pg16` (for rollback capability)
- **Minimum Credentials:** User with CREATE TABLE privilege

## Architecture

```mermaid
graph TD
    A[paperless-ai Container] -->|QDRANT_HOST=qdrant| Q[Qdrant Container]
    A -->|POSTGRES_HOST=db| B[paperless_db Container]

    Q -->|qdrant/qdrant:latest| R[Qdrant Vector DB]
    R -->|Collection| S[document_embeddings 384D Cosine]
    R -->|Collection| T[visual_overlays 320D Cosine]
    R -->|Collection| U[visual_pages 320D Dot]

    B -->|postgres:16| C[PostgreSQL 16]
    C -->|Table| E[visual_overlays - metadata only]
    E -->|Columns| G[expert_metadata JSONB]
    E -->|Columns| H[domain_signals JSONB]
    C -->|Table| L[feedback_events Table]
    L -->|Columns| M[original_value vs corrected_value]

## Qdrant Collections

All vector embeddings are now stored in Qdrant collections:

| Collection | Dimensions | Distance | Purpose | Adapter |
|------------|------------|----------|---------|---------|
| `document_embeddings` | 384 | Cosine | Text RAG embeddings | `rag_service/qdrant_adapter.py` |
| `visual_overlays` | 320 | Cosine | Visual overlay embeddings | `services/visual-rag/QdrantAdapter.js` |
| `visual_pages` | 320 | Dot | Visual RAG sidecar embeddings | `rag_service/qdrant_adapter.py` |

### Collection Schema

Each collection stores points with:
- **ID**: UUID (generated from doc_id + page_number or chunk_index)
- **Vector**: Embedding array (384D or 320D depending on collection)
- **Payload**: Metadata (doc_id, title, content, page_number, etc.)

### PostgreSQL Visual Overlays Table (Metadata Only)

The `visual_overlays` PostgreSQL table stores metadata only — **no vector columns**. Qdrant is the SOT for vectors; use payload mirroring (`doc_id`, `correspondent_id`, `tag_ids`) for expert filtering.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | SERIAL | Primary key |
| `doc_id` | INTEGER | Document reference |
| `page_number` | INTEGER | Page number |
| `overlay_data` | JSONB | Overlay bounding boxes |
| `semantic_label` | TEXT | Content classification |
| `expert_metadata` | JSONB | Expert knowledge |
| `domain_signals` | JSONB | Domain-specific signals |

## Configuration

### Environment Variables

Required variables in `docker-compose.env`:

```bash
# Qdrant Configuration (Vector Storage)
QDRANT_HOST=qdrant
QDRANT_PORT=6333
VECTOR_STORE=qdrant  # Options: qdrant, pgvector (for rollback)

# Standard PostgreSQL convention (Metadata Storage)
POSTGRES_USER=elfman
POSTGRES_PASSWORD=<your-password>
POSTGRES_DB=paperless
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Paperless-NGX convention (fallback)
PAPERLESS_DBUSER=elfman
PAPERLESS_DBPASS=<your-password>
PAPERLESS_DBNAME=paperless
PAPERLESS_DBHOST=db
PAPERLESS_DBPORT=5432

# Project name for consistent container naming
COMPOSE_PROJECT_NAME=paperless-ngx
```

### Docker Compose Configuration

Add Qdrant and PostgreSQL services to `docker-compose.yml`:

```yaml
services:
  # Qdrant Vector Database
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

  # PostgreSQL (Metadata Only)
  db:
    image: postgres:16
    container_name: paperless_db
    ports:
      - "5432:5432"
    env_file: .env
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

volumes:
  qdrant_storage:
```

## Verification

### 1. Check Container Status

```bash
# Verify Qdrant is running
docker ps | grep paperless_qdrant

# Verify PostgreSQL is running
docker ps | grep paperless_db
```

### 2. Verify Qdrant Collections

```bash
# Check Qdrant health
curl http://localhost:6333/health

# List collections
curl http://localhost:6333/collections

# Check collection info using verification script
node scripts/check-qdrant-collections.js

# Run integration tests
QDRANT_HOST=localhost npm test -- test/integration/qdrant-adapter.spec.js
```

### 3. Test Application Health

```bash
# Check database health endpoint
curl http://localhost:3000/health/database

# Expected response includes Qdrant status:
# {
#   "status": "healthy",
#   "qdrant": { "healthy": true, "collections": {...} },
#   "postgres": { "connected": true }
# }
```

## Troubleshooting

### Issue: "Qdrant connection failed"

**Symptoms:**
- Startup logs show: `[STARTUP] Qdrant connection failed`
- Health check returns: `"qdrant": { "healthy": false }`

**Solution:**

1. Verify Qdrant container is running:
   ```bash
   docker ps | grep paperless_qdrant
   ```

2. Check Qdrant health directly:
   ```bash
   curl http://localhost:6333/health
   ```

3. Check container logs:
   ```bash
   docker logs paperless_qdrant
   ```

4. Verify environment variables:
   ```bash
   docker exec paperless_ai env | grep QDRANT
   # Should show: QDRANT_HOST=qdrant, QDRANT_PORT=6333
   ```

### Issue: "Collection not found"

**Symptoms:**
- Search returns empty or error
- Health check shows collection missing

**Solution:**

Collections are auto-created on first use. Restart the service:

```bash
docker-compose restart paperless-ai

# Or manually initialize via adapter
node -e "require('./services/visual-rag/QdrantAdapter').qdrantAdapter.initialize()"
```

### Issue: "PostgreSQL connection failed"

**Symptoms:**
- `[STARTUP] Database connection failed`
- Cannot store metadata

**Solution:**

1. Check PostgreSQL container:
   ```bash
   docker ps | grep paperless_db
   docker logs paperless_db
   ```

2. Test connection:
   ```bash
   docker exec -it paperless_db psql -U elfman -d paperless
   ```

### Issue: "Database connection failed"

**Symptoms:**
- `[STARTUP]  Database connection failed`
- Cannot connect to PostgreSQL

**Solution:**

1. Check container is running:
   ```bash
   docker ps | grep paperless_db
   ```

2. Check container logs:
   ```bash
   docker logs paperless_db
   ```

3. Verify credentials:
   ```bash
   # Test connection manually
docker exec -it paperless_db psql -U elfman -d paperless
   ```

4. Check environment variables:
   ```bash
   # In paperless-ai container
docker exec paperless_ai env | grep POSTGRES
   ```

### Issue: "FATAL: database \"elfman\" does not exist" (missing DB, collation mismatch) ⚠️

**Symptoms:**
- Logs show: `FATAL: database "elfman" does not exist`
- The PostgreSQL container has existing data so initialization skipped and env changes (e.g., `POSTGRES_DB`) were ignored.

**Quick, non-destructive fixes:**
1. List existing databases to confirm what the cluster contains:
   ```bash
   docker exec -it paperless_db psql -U elfman -c "\l"
   ```

2. Create the missing database with the correct collation (recommended; uses TEMPLATE template0):
   ```bash
   docker exec -it paperless_db psql -U postgres -c "CREATE DATABASE elfman WITH OWNER elfman LC_COLLATE='en_US.utf8' LC_CTYPE='en_US.utf8' TEMPLATE template0;"
   ```

3. Run migrations against the new DB (ensure `POSTGRES_*` env in the `paperless_ai` container points to the correct DB):
   ```bash
   docker exec paperless_ai node migrations/run-migration.js
   ```

4. If you intended to change the cluster-wide DB name (destructive): stop containers, remove the `pgdata` volume and restart so Postgres re-initializes with the new env vars. WARNING: this deletes all DB data.
   ```bash
   docker compose down
   docker volume rm <project>_pgdata
   docker compose --env-file docker-compose.env up -d db
   ```

**Notes:**
- Use `TEMPLATE template0` when creating DBs with non-default collations to avoid inheriting incompatible locale metadata.
- On Windows, prefer starting Compose with explicit env file to ensure the authoritative `docker-compose.env` values are used:
  ```bash
  docker compose --env-file docker-compose.env up -d
  ```
- If healthchecks hard-code a username (e.g., `elfman`) they can become inconsistent; we updated `docker-compose.yml` to use `${POSTGRES_USER}`/`${POSTGRES_DB}` so the check follows your configured env vars.

### Issue: Collation version mismatch (warning during startup)

**Symptoms:**
- Startup or readiness checks show a warning like:
  ```
  WARNING:  database "paperless" has a collation version mismatch
  DETAIL:  The database was created using collation version 2.36, but the operating system provides version 2.41.
  HINT:  Rebuild all objects in this database that use the default collation and run ALTER DATABASE paperless REFRESH COLLATION VERSION
  ```

**Non-destructive recovery steps (recommended):**
1. **Backup first (always):**
   - On Linux/macOS:
     ```bash
     mkdir -p ./backups
     docker exec -t paperless_db pg_dump -U postgres -F c paperless > ./backups/paperless.dump
     ```
   - On Windows PowerShell:
     ```powershell
     New-Item -ItemType Directory -Force .\backups
     docker exec -t paperless_db pg_dump -U postgres -F c paperless | Out-File -Encoding byte .\backups\paperless.dump
     ```

2. **Rebuild indexes/objects that depend on collation:**
   ```bash
   docker exec -it paperless_db psql -U postgres -d paperless -c "REINDEX DATABASE paperless;"
   ```

3. **Refresh the database collation version:**
   ```bash
   docker exec -it paperless_db psql -U postgres -c "ALTER DATABASE paperless REFRESH COLLATION VERSION;"
   ```

4. **Verify:**
   - Check logs and readiness:
     ```bash
     docker logs paperless_db --since 1m
     docker exec paperless_db pg_isready -U ${POSTGRES_USER:-elfman} -d ${POSTGRES_DB:-paperless}
     ```
   - Your earlier warning should no longer appear.

**Fallback (dump/restore) if problems persist:**
- If REINDEX + REFRESH fails or you continue to see collation inconsistencies, perform a dump-and-restore into a database explicitly created with the correct locale:
  ```bash
  # create a new DB with the same owner and explicit collation
  docker exec -it paperless_db psql -U postgres -c "CREATE DATABASE paperless_rebuilt WITH OWNER elfman LC_COLLATE='en_US.utf8' LC_CTYPE='en_US.utf8' TEMPLATE template0;"

  # restore the dump into the new DB
  docker exec -i paperless_db pg_restore -U postgres -d paperless_rebuilt < ./backups/paperless.dump

  # test the application against the rebuilt DB and, after validation, swap names or update your env to point to the rebuilt DB
  ```

**Notes & cautions:**
- Always take a backup before performing maintenance.
- Perform these steps during a maintenance window and test the application after changes.
- If you are uncertain, ask for operator assistance — I can prepare the exact PowerShell-compatible commands or perform the steps here if you want.

### Removing deprecated `pgvector` extension (cleanup & prevention)

If your deployment previously used `pgvector` but moved vectors to Qdrant, you may have residual extension objects, indexes or columns referencing the `vector` type. The safe, tested cleanup pattern we used is below. Follow these steps during a maintenance window.

1. Backup the database (always first):

   On PowerShell (Windows):
   ```powershell
   New-Item -ItemType Directory -Force .\backups
   docker exec -i paperless_db bash -lc "pg_dump -U postgres -F c paperless -f /tmp/paperless.dump"
   docker cp paperless_db:/tmp/paperless.dump .\backups\paperless.dump
   ```

   On Linux / macOS:
   ```bash
   mkdir -p ./backups
   docker exec -i paperless_db bash -lc "pg_dump -U postgres -F c paperless -f /tmp/paperless.dump"
   docker cp paperless_db:/tmp/paperless.dump ./backups/paperless.dump
   ```

2. Inspect extension and dependent objects:

```bash
# List installed extensions
docker exec -i paperless_db psql -U elfman -d paperless -c "SELECT extname FROM pg_extension;"

# Show extension detail (objects)
docker exec -i paperless_db psql -U elfman -d paperless -c "\dx+ vector"

# Find columns using the vector type
docker exec -i paperless_db psql -U elfman -d paperless -c "SELECT n.nspname, c.relname, a.attname FROM pg_attribute a JOIN pg_class c ON a.attrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid JOIN pg_type t ON a.atttypid = t.oid WHERE t.typname = 'vector' AND a.attnum > 0 AND NOT a.attisdropped;"
```

3. Drop the extension (safe; use CASCADE to remove dependent objects like vector columns/indexes):

```bash
# Drop extension (will cascade)
docker exec -i paperless_db psql -U elfman -d paperless -c "DROP EXTENSION IF EXISTS vector CASCADE;"
```

4. If any vector indexes or columns were not removed, drop them explicitly (example):

```bash
docker exec -i paperless_db psql -U elfman -d paperless -c "DROP INDEX IF EXISTS public.idx_visual_overlays_embedding_ivfflat;"
docker exec -i paperless_db psql -U elfman -d paperless -c "ALTER TABLE public.visual_overlays DROP COLUMN IF EXISTS embedding;"
```

5. Rebuild indexes and refresh collation version (fixes collation warning if present):

```bash
docker exec -i paperless_db psql -U elfman -d paperless -c "REINDEX DATABASE paperless;"
docker exec -i paperless_db psql -U elfman -c "ALTER DATABASE paperless REFRESH COLLATION VERSION;"
```

6. Remove any compiled extension files from the running image (only needed if you built in-container):

```bash
docker exec -i paperless_db bash -lc "rm -f /usr/lib/postgresql/16/lib/vector.so || true"
docker exec -i paperless_db bash -lc "rm -rf /usr/share/postgresql/16/extension/vector* /usr/include/postgresql/16/server/extension/vector /usr/lib/postgresql/16/lib/bitcode/vector || true"
```

7. Remove build-time packages (if installed during on-host build steps):

```bash
docker exec -i paperless_db bash -lc "apt-get remove --purge -y build-essential git postgresql-server-dev-16 clang llvm make pkg-config libssl-dev || true; apt-get autoremove -y || true; apt-get clean -y || true"
```

8. Verify and confirm:

```bash
docker exec -i paperless_db psql -U elfman -d paperless -c "SELECT extname FROM pg_extension;"
docker exec -i paperless_db psql -U elfman -d paperless -c "SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns WHERE data_type ILIKE '%vector%';"
docker exec paperless_db pg_isready -U ${POSTGRES_USER:-elfman} -d ${POSTGRES_DB:-paperless}
```

Notes & prevention
- **Policy:** Do NOT include `pgvector` in runtime images. Runtime images must not ship the compiled `pgvector` extension or any pgvector-built artifacts (e.g., `vector.so` files). If you need temporary access for migration or testing, perform builds in a safe, private, build-only environment and use the provided migration/purge scripts. The repository contains a guard workflow (`.github/workflows/no-pgvector-guard.yml`) that will prevent changes that reintroduce pgvector artifacts into non-exempt areas of the repo.
- Keep the backup `./backups/paperless.dump` until you are confident the cleanup succeeded.

### Issue: Container name has random suffix

**Symptoms:**
- Container named `paperless_db_1` or `paperless-ngx_paperless_db_1`

**Solution:**

Set explicit project name in `docker-compose.env`:

```bash
COMPOSE_PROJECT_NAME=paperless-ngx
```

Then recreate containers:

```bash
docker-compose down
docker-compose up -d
```

## Manual Migration

If automatic schema creation fails, run migration manually:

```bash
# Run migration script
docker exec paperless_ai node migrations/run-migration.js

# Or execute SQL directly
docker exec -i paperless_db psql -U elfman -d paperless < migrations/init_council_storage.sql

# Ensure pgcrypto (gen_random_uuid) extension is installed before running PostgreSQL migrations
docker exec paperless_db psql -U elfman -d paperless -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"

# Apply the feedback_events migration directly (Postgres)
docker exec -i paperless_db psql -U elfman -d paperless < migrations/002_create_feedback_events.sql

# Rollback (if needed)
docker exec -i paperless_db psql -U elfman -d paperless < migrations/002_rollback_feedback_events.sql
```

## Health Monitoring

### Startup Validation

The application validates both Qdrant and PostgreSQL connectivity at startup:

```
[STARTUP] Validating Qdrant connection...
[STARTUP] Qdrant credentials: { host: 'qdrant', port: 6333 }
[STARTUP] ✓ Qdrant connection successful
[STARTUP] Checking Qdrant collections...
[STARTUP] ✓ document_embeddings: ready (1234 points)
[STARTUP] ✓ visual_overlays: ready (567 points)
[STARTUP] ✓ visual_pages: ready (890 points)
[STARTUP] Validating PostgreSQL connection...
[STARTUP] ✓ PostgreSQL connection successful
[STARTUP] ✓ Metadata schema ready
```

### Health Check Endpoints

- **Basic health:** `GET /health`
- **Database health:** `GET /health/database`
- **Qdrant health (direct):** `GET http://qdrant:6333/health`

### Monitoring Commands

```bash
# Check Qdrant collections
node scripts/check-qdrant-collections.js

# Qdrant collection stats
curl http://localhost:6333/collections/document_embeddings

# PostgreSQL metadata queries
docker exec -it paperless_db psql -U elfman -d paperless -c "SELECT COUNT(*) FROM visual_overlays;"
```

## Performance Tuning

### Qdrant Configuration

Qdrant automatically optimizes indexes. Key settings in environment:

```bash
# Enable on-disk payload storage for large datasets
QDRANT__STORAGE__ON_DISK_PAYLOAD=true

# Increase memory limit if needed
QDRANT__SERVICE__MAX_REQUEST_SIZE_MB=100
```

### Connection Pool Settings

Adjust in `config.js`:

```javascript
postgres: {
  max: 5,                      // Maximum connections
  idleTimeoutMillis: 30000,    // Idle timeout
  connectionTimeoutMillis: 5000 // Connection timeout
}
```

## References

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [qdrant-client Python](https://github.com/qdrant/qdrant-client)
- [qdrant-js JavaScript](https://github.com/qdrant/qdrant-js)
- [QDRANT_MIGRATION.md](./QDRANT_MIGRATION.md) - Migration guide from pgVector
- [PostgreSQL Documentation](https://www.postgresql.org/docs/current/)
- [Docker Compose Networking](https://docs.docker.com/compose/networking/)
