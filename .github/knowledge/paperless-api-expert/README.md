# Paperless-ngx API Expert — Knowledge Base

This knowledge base is used by the **paperless-api-expert** Copilot agent as authoritative context.
It is intentionally **MCP-tool-agnostic**: it documents the Paperless-ngx REST API surface and usage patterns.

## How the agent must use this KB
1. Read **authentication.md** and **documents.md** first.
2. For bulk changes, read **bulk-operations.md** and **errors-and-status-codes.md**.
3. For filtering/pagination, read **search-and-filters.md** and **pagination-and-ordering.md**.
4. Use **examples-node.md** as the canonical implementation patterns (axios + FormData).

## Versioning policy
- Use API versioning header:
  - `Accept: application/json; version=<API_VERSION>`
- Validate server response headers when possible:
  - `X-Api-Version`
  - `X-Version`

If your deployment uses a different API version than shown here, update this KB first.
