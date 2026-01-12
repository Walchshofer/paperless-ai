# Implementation notes — Pipelined Concurrency & Response Ordering

Implemented deliverables for ticket
`a4abe471-809a-479c-9a87-50f926c7a3bc`:

- Enhanced `codex-bridge.py` with pipelined concurrency:
  - `PendingRequest` dataclass and `state` additions: `pending_requests`,
    `response_buffer`, `response_delivery_queue` and locks.
  - Background helpers: `_forward_and_match`, `match_response`, and
    `deliver_responses` for ordered, serialized stdout delivery.
  - `handle_jsonrpc` now registers pending requests and forwards in
    background allowing multiple in-flight requests.
  - `BridgeState.clear_session` was extended to clear buffers and
    drain the delivery queue to prevent memory leaks on disconnect.
- Unit tests: `test/unit/test_pipelined_ordering.py` verifying that
  responses arriving out-of-order are delivered in request order.

Notes and next steps
- Add integration tests using a mock Serena server to exercise timeouts
  and reconnection behavior in concert with pipelined requests.
- Consider edge cases: very large numbers of concurrent requests and
  backpressure on the delivery queue; add metrics and limits if needed.

References
- Epic: cc933dfe-2d44-4bf7-9acf-59674d03f4b1
- Ticket: a4abe471-809a-479c-9a87-50f926c7a3bc
