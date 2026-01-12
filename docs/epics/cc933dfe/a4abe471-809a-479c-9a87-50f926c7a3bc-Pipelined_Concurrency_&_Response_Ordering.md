---
id: "a4abe471-809a-479c-9a87-50f926c7a3bc"
title: "Pipelined Concurrency & Response Ordering"
assignee: ""
status: 0
createdAt: "1768224314900"
updatedAt: "1768224393223"
type: ticket
---

# Pipelined Concurrency & Response Ordering

## Objective

Enhance the Request Router to support pipelined concurrency: multiple in-flight requests with responses delivered in request order.

## Scope

**Included:**
- Request tracking with `OrderedDict` and `completed_requests` set
- Response ordering buffer for out-of-order responses
- Response delivery queue for serialized stdout writes
- `match_response()` logic for ordering enforcement
- `deliver_responses()` background task
- Concurrent request handling with fine-grained locking

**Excluded:**
- Error retry logic (handled in Ticket 5)
- Error enrichment (handled in Ticket 5)

## Spec References

- `spec:cc933dfe-2d44-4bf7-9acf-59674d03f4b1/7b341776-0d89-4383-82ec-a2a23840f378` - Flow 2: Message Routing (pipelined section)
- `spec:cc933dfe-2d44-4bf7-9acf-59674d03f4b1/e73e3f6d-2801-4830-85b4-f76ee5cb3efd` - Decision 2: Pipelined Concurrency Model
- `spec:cc933dfe-2d44-4bf7-9acf-59674d03f4b1/e73e3f6d-2801-4830-85b4-f76ee5cb3efd` - Data Model: Request Tracking, Response Ordering Buffer

## Key Deliverables

1. **Request Tracking Structures**
   - `pending_requests: OrderedDict[Any, PendingRequest]`
   - `completed_requests: set[Any]`
   - `pending_requests_lock: asyncio.Lock`
   - `PendingRequest` dataclass with `response_future`

2. **Response Ordering Logic**
   - `response_buffer: Dict[Any, Dict]`
   - `response_delivery_queue: asyncio.Queue`
   - `match_response()`: Check if earlier requests completed, buffer or deliver
   - Logic to unblock buffered responses when earlier requests complete

3. **Concurrent Request Handling**
   - Multiple requests can be in-flight simultaneously
   - Each request waits on its own `asyncio.Future`
   - Responses delivered in request order via queue

4. **deliver_responses() Background Task**
   - Continuously read from `response_delivery_queue`
   - Write to stdout (serialized, no concurrent writes)
   - Flush after each write

## Acceptance Criteria

- [ ] Multiple requests can be in-flight simultaneously
- [ ] Responses are delivered in the order requests were sent (even if they arrive out of order)
- [ ] Timeout of one request doesn't block delivery of later responses
- [ ] Response buffer is cleared on connection drop (no memory leaks)
- [ ] Integration tests verify pipelined concurrency with mock Serena server
- [ ] Test scenario: Send 3 requests, receive responses in reverse order, verify delivery order matches request order

## Dependencies

- **Requires**: Ticket 3 (Basic Request Forwarding)

## Estimated Complexity

**High** - Complex concurrency logic with ordering constraints and buffer management.
