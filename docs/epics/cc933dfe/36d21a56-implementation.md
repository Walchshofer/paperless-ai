Implemented integration tests per ticket 36d21a56.

- Added new tests (connection lifecycle, pipelined concurrency, timeouts & error handling)
- Tests use `MockSerenaServer` fixture
- Local run: all new integration tests pass (7 passed)

Acceptance checklist:
- [x] Integration tests added
- [x] Mock server used for deterministic testing
- [ ] End-to-end tests (manual / optional)
- [ ] Ensure >= 80% coverage for bridge code (follow-up)
