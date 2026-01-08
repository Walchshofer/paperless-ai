# Authentication

## Token auth (preferred)
- **Endpoint:** `POST /api/token/`  
- **Header on all requests:** `Authorization: Token {token}`

## Current user
- **Endpoint:** `GET /api/users/me/`

## Versioning header (mandatory)
- **Header:** `Accept: application/json; version=6` (example)
- Your deployment may use a different version; ensure the client and server agree.

## Alternative auth (if enabled)
- **Header:** `Authorization: Basic {base64(username:password)}`
