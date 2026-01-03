# PostgreSQL + pg_vector Setup Guide

## Overview

Paperless-AI uses PostgreSQL with the pg_vector extension for visual overlay storage and semantic search capabilities. This guide covers setup, troubleshooting, and common issues.

## Requirements

- **PostgreSQL Version:** 16+
- **Required Extension:** pg_vector (vector similarity search)
- **Docker Image:** `pgvector/pgvector:pg16`
- **Minimum Credentials:** User with CREATE EXTENSION privilege

## Architecture

```mermaid
graph TD
    A[paperless-ai Container] -->|POSTGRES_HOST=db| B[paperless_db Container]
    B -->|pgvector/pgvector:pg16| C[PostgreSQL 16]
    C -->|Extension| D[pg_vector]
    D -->|Stores| E[visual_overlays Table]
    E -->|Columns| F[embedding vector 768]
    E -->|Columns| G[expert_metadata JSONB]
    E -->|Columns| H[domain_signals JSONB]
```

## Configuration

### Environment Variables

Required variables in `docker-compose.env`:

```bash
# Standard PostgreSQL convention (preferred)
POSTGRES_USER=elfman
POSTGRES_PASSWORD=P2tr3ck!1976
POSTGRES_DB=paperless
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Paperless-NGX convention (fallback)
PAPERLESS_DBUSER=elfman
PAPERLESS_DBPASS=P2tr3ck!1976
PAPERLESS_DBNAME=paperless
PAPERLESS_DBHOST=db
PAPERLESS_DBPORT=5432

# Project name for consistent container naming
COMPOSE_PROJECT_NAME=paperless-ngx
```

### Docker Compose Configuration

Ensure `docker-compose.yml` uses the correct image:

```yaml
db:
  image: pgvector/pgvector:pg16  #  Must use pgvector image
  container_name: paperless_db
  ports:
    - "5432:5432"
  env_file: docker-compose.env
  environment:
    - POSTGRES_DB=${POSTGRES_DB}
    - POSTGRES_USER=${POSTGRES_USER}
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
```

## Verification

### 1. Check Container Status

```bash
# Verify container is running
docker ps | grep paperless_db

# Expected output:
# paperless_db   pgvector/pgvector:pg16   ...   Up   0.0.0.0:5432->5432/tcp
```

### 2. Verify pg_vector Extension

```bash
# Check if extension is available
docker exec paperless_db psql -U elfman -d paperless -c "SELECT * FROM pg_available_extensions WHERE name = 'vector'"

# Check if extension is installed
docker exec paperless_db psql -U elfman -d paperless -c "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
```

### 3. Test Application Health

```bash
# Check database health endpoint
curl http://localhost:3000/health/database

# Expected response:
# {
#   "status": "healthy",
#   "database": { "connected": true, ... },
#   "pgvector": { "available": true, "version": "0.5.1" },
#   "schema": { "ready": true }
# }
```

## Troubleshooting

### Issue: "pgvector extension not available"

**Symptoms:**
- Startup logs show: `[STARTUP]  pg_vector extension not available`
- Health check returns: `"pgvector": { "available": false }`

**Solution:**

1. Verify Docker image:
   ```bash
   docker inspect paperless_db | grep Image
   # Should show: pgvector/pgvector:pg16
   ```

2. If using wrong image, update `docker-compose.yml` and recreate:
   ```bash
   docker-compose down
   docker-compose up -d db
   ```

3. Manually install extension:
   ```bash
   docker exec paperless_db psql -U elfman -d paperless -c "CREATE EXTENSION IF NOT EXISTS vector"
   ```

### Issue: "Type 'vector' does not exist"

**Symptoms:**
- Error code: `42704`
- Schema creation fails with type error

**Solution:**

Extension is available but not installed:

```bash
# Install extension
docker exec paperless_db psql -U elfman -d paperless -c "CREATE EXTENSION vector"

# Verify installation
docker exec paperless_db psql -U elfman -d paperless -c "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
```

### Issue: "Permission denied for database"

**Symptoms:**
- Error code: `42501`
- User cannot create extension

**Solution:**

Grant required privileges:

```bash
# Option 1: Grant CREATE privilege
docker exec paperless_db psql -U postgres -d paperless -c "GRANT CREATE ON DATABASE paperless TO elfman"

# Option 2: Use superuser credentials in docker-compose.env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<superuser_password>
```

### Issue: "Database connection failed"

**Symptoms:**
- `[STARTUP]  Database connection failed`
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
```

## Health Monitoring

### Startup Validation

The application validates database connectivity at startup:

```
[STARTUP] Validating database connection...
[STARTUP] Database credentials: { host: 'db', port: 5432, ... }
[STARTUP] ✓ Database connection successful
[STARTUP] Checking pg_vector extension...
[STARTUP] ✓ pg_vector extension available (version: 0.5.1)
[STARTUP] Ensuring database schema...
[STARTUP] ✓ Database schema ready
```

### Health Check Endpoints

- **Basic health:** `GET /health`
- **Database health:** `GET /health/database`

### Monitoring Queries

```sql
-- Check table structure
\d visual_overlays

-- Count overlays
SELECT COUNT(*) FROM visual_overlays;

-- Check pg_vector version
SELECT extversion FROM pg_extension WHERE extname = 'vector';

-- List all extensions
SELECT * FROM pg_extension;
```

## Performance Tuning

### Index Optimization

The schema creates HNSW indexes for vector search:

```sql
-- Check index status
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'visual_overlays';

-- Rebuild index if needed
REINDEX INDEX idx_visual_overlays_embedding;
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

- [pg_vector Documentation](https://github.com/pgvector/pgvector)
- [PostgreSQL Extensions](https://www.postgresql.org/docs/current/sql-createextension.html)
- [Docker Compose Networking](https://docs.docker.com/compose/networking/)
