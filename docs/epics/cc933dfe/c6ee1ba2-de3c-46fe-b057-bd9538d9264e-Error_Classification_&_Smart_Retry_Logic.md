---
id: "c6ee1ba2-de3c-46fe-b057-bd9538d9264e"
title: "Error Classification & Smart Retry Logic"
assignee: ""
status: 0
createdAt: "1768224329750"
updatedAt: "1768224393238"
type: ticket
---

# Error Classification & Smart Retry Logic

## Objective

Implement the Error Handler component with error classification, smart retry logic, and error enrichment for actionable LLM feedback.

## Scope

**Included:**
- Error classification (transient vs permanent)
- Retry decision logic with exponential backoff
- Error enrichment with bridge context
- Retry loop implementation in Request Router
- `RetryState` tracking

**Excluded:**
- Connection retry logic (already in Ticket 2)
- Basic error responses (already in Ticket 3)

## Spec References

- `spec:cc933dfe-2d44-4bf7-9acf-59674d03f4b1/7b341776-0d89-4383-82ec-a2a23840f378` - Flow 3: Error Handling & Recovery
- `spec:cc933dfe-2d44-4bf7-9acf-59674d03f4b1/e73e3f6d-2801-4830-85b4-f76ee5cb3efd` - Component 5: Error Handler
- `spec:cc933dfe-2d44-4bf7-9acf-59674d03f4b1/e73e3f6d-2801-4830-85b4-f76ee5cb3efd` - Decision 5: Smart Retry

## Key Deliverables

1. **Error Classification**
   - `classify_error(error)`: Determine transient vs permanent
   - Transient: `asyncio.TimeoutError`, HTTP 503/429, connection errors
   - Permanent: HTTP 400/404, JSON-RPC errors, malformed responses

2. **Retry Decision Logic**
   - `should_retry(error, retry_state)`: Returns `(bool, float)` tuple
   - Check error type and retry count
   - Calculate exponential backoff: `1s, 2s, 4s`
   - Max 3 retry attempts

3. **Error Enrichment**
   - `enrich_error(error, context)`: Add bridge context to error messages
   - Bridge timeouts: "Bridge timeout after 120s waiting for Serena response to 'search_code'"
   - Connection errors: "Serena unavailable - connection in progress (attempt 3/10)"
   - Serena errors: "Serena error: {original_message}"
   - Include `data` field with operation context

4. **Retry Loop in Request Router**
   - Integrate `ErrorHandler.should_retry()` into `route_request()`
   - Implement retry loop with backoff
   - Track retry attempts per request
   - Log retry attempts to stderr

## Acceptance Criteria

- [ ] Transient errors (timeouts, 503) are retried up to 3 times
- [ ] Permanent errors (400, JSON-RPC errors) are not retried
- [ ] Error messages include bridge context to distinguish error source
- [ ] Retry attempts use exponential backoff (1s, 2s, 4s)
- [ ] All errors logged to stderr with full context
- [ ] Unit tests for error classification logic
- [ ] Integration tests verify retry behavior with mock Serena server

## Dependencies

- **Requires**: Ticket 3 (Basic Request Forwarding)

## Estimated Complexity

**Medium** - Well-defined logic, but requires careful error handling and retry state management.
