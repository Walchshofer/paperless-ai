# Errors and HTTP status codes

## Common codes
- 200 OK
- 201 Created
- 204 No Content (delete)
- 400 Bad Request (validation, malformed payload)
- 401 Unauthorized (missing/invalid auth)
- 403 Forbidden (insufficient permissions)
- 404 Not Found (bad URL or missing resource)
- 409 Conflict (duplicate name, state conflict)
- 500 Server error

## Triage guidance
- 400: validate payload types; validate created format; validate custom_field_query encoding
- 401: verify token header format `Authorization: Token <token>`
- 403: verify user permissions / ownership; check object permission sets
- 404: verify base URL ends with `/api/`; confirm IDs
- 409: resolve name conflicts or concurrent operations
