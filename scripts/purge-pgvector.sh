#!/usr/bin/env bash
set -euo pipefail

# Purge pgvector artifacts from a running Postgres container named 'paperless_db'
# Usage: ./scripts/purge-pgvector.sh

echo "Backing up database to ./backups/paperless.dump"
mkdir -p ./backups
docker exec -i paperless_db bash -lc "pg_dump -U postgres -F c paperless -f /tmp/paperless.dump"
docker cp paperless_db:/tmp/paperless.dump ./backups/paperless.dump

echo "Dropping extension and cleaning columns/indexes"
docker exec -i paperless_db psql -U elfman -d paperless -c "DROP EXTENSION IF EXISTS vector CASCADE;" || true
# example index/column cleanup (adjust to your schema)
docker exec -i paperless_db psql -U elfman -d paperless -c "DROP INDEX IF EXISTS public.idx_visual_overlays_embedding_ivfflat;" || true
docker exec -i paperless_db psql -U elfman -d paperless -c "ALTER TABLE public.visual_overlays DROP COLUMN IF EXISTS embedding;" || true

echo "Reindexing & refreshing collation"
docker exec -i paperless_db psql -U elfman -d paperless -c "REINDEX DATABASE paperless;"
docker exec -i paperless_db psql -U elfman -c "ALTER DATABASE paperless REFRESH COLLATION VERSION;"

echo "Removing compiled artifacts and build deps (if present)"
docker exec -i paperless_db bash -lc "rm -f /usr/lib/postgresql/16/lib/vector.so || true"
docker exec -i paperless_db bash -lc "rm -rf /usr/share/postgresql/16/extension/vector* /usr/include/postgresql/16/server/extension/vector /usr/lib/postgresql/16/lib/bitcode/vector || true"
docker exec -i paperless_db bash -lc "apt-get remove --purge -y build-essential git postgresql-server-dev-16 clang llvm make pkg-config libssl-dev || true; apt-get autoremove -y || true; apt-get clean -y || true"

echo "Final verification"
docker exec -i paperless_db psql -U elfman -d paperless -c "SELECT extname FROM pg_extension;"
docker exec -i paperless_db psql -U elfman -d paperless -c "SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns WHERE data_type ILIKE '%vector%';"
docker exec paperless_db pg_isready -U ${POSTGRES_USER:-elfman} -d ${POSTGRES_DB:-paperless}

echo "Done."
