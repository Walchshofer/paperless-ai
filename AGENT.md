# Agent Quick Reference (Auth)

Canonical project instructions are in `AGENTS.md`.

## Environment SOT (Local + Docker)
- Authoritative source: `docker-compose.env` (repo root).
- Compatibility file: `./.env` is generated from `docker-compose.env` via
  `npm run env:sync`.
- Runtime overrides: `data/runtime.env` is app-managed and runtime-safe only.
- Protected infra/secrets (`PAPERLESS_API_*`, `POSTGRES_*`, `QDRANT_*`,
  service URLs/tokens) must never be written to `data/runtime.env`.
- Legacy `data/.env` is deprecated and should not be used.

## Login and Cookie
- Login endpoint: `POST /login` with `username` and `password`.
- Success redirect:
  - `/dashboard` (normal)
  - `/workspace` (E2E mode: `NODE_ENV=test` or `PLAYWRIGHT_E2E=true` or `E2E_TESTS=true`)
- Session cookie name: `jwt`
- Cookie attributes (current): `httpOnly=true`, `sameSite=lax`, `path=/`, `maxAge=24h`, `secure=false`

## How auth is accepted
- Middleware reads token in this order:
  1. Cookie `jwt`
  2. `Authorization: Bearer <jwt>`
- Page routes redirect to `/login` on auth failure.
- API routes return JSON `401/403` on auth failure.

## Obtain cookie from CLI
```bash
curl -i -c cookie.txt \
  -X POST "http://localhost:3000/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "username=elfman&password=P2tr3ck!1976"

curl -b cookie.txt "http://localhost:3000/api/prompts"
```

## Playwright and fixtures
- Login selectors: `#username`, `#password`, `[data-testid="login-submit-btn"]`
- Storage state path: `test/.auth/storageState.json`
- E2E fixtures require:
  - `PAPERLESS_API_URL`
  - `PAPERLESS_API_TOKEN`
