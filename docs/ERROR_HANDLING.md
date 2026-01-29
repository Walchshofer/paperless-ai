# Error handling & logging (short guide)

## Purpose
This document describes the global error handling and logging behavior introduced in the 2026-01-29 change: a 404 middleware, enhanced global error handler, an error page (`views/error.ejs`), and structured logging for HTTP errors.

## Behavior
- 404s are forwarded to the global error handler as an `Error('Not Found')` with `status = 404`.
- The global error handler inspects `err.status || err.statusCode || 500` and returns:
  - An API JSON error for routes starting with `/api`:
    - `{ error: 'not_found', message: 'Resource not found' }` for 404
    - `{ error: 'internal_error', message: 'Internal server error' }` for 500
  - A human-friendly HTML page rendered via `views/error.ejs` for non-API requests.
- Error details (message/stack) are **only** included in responses or pages when `NODE_ENV === 'development'` to avoid leaking sensitive details in production.

## Logging
- The handler logs structured context (method, URL, status, message, user when available) along with the stack.
- If a `logger` (project logger) is available, it is used: `logger.error({ event: 'http_error', method, url, user, status, message, stack })`.
- If no `logger` is available, falls back to `console.error('[ERROR] http_error', context, stack)`.
- The handler uses try/catch around logging to avoid cascading failures.

## Developer notes
- If you add a new route that intentionally returns a 4xx or 5xx, set `err.status` appropriately and `throw` or `next(err)`; the global error handler will take care of logging and rendering.
- For APIs, prefer returning JSON errors with stable error codes (e.g., `internal_error`, `not_found`) so clients can handle them consistently.

## Files
- `server.js` — 404 middleware + enhanced error handler implementation.
- `views/error.ejs` — human-friendly error page (shows `details` only in dev).
- `test/routes/error.handler.test.js` — unit tests for handler behaviors.

## How to test locally
- Run unit tests: `npm test -- test/routes/error.handler.test.js`.
- Start server with `NODE_ENV=development` and confirm stack traces appear on the error page for debug routes.
- Start server with `NODE_ENV=production` and confirm pages expose only friendly messages and APIs return JSON without details.

---

This is a short guide — add further operational or incident instructions to the Ops runbook if you want to capture support-debugging steps (e.g., log locations, correlation IDs).