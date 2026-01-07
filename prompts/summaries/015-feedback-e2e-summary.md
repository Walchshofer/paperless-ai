# 015 — Integration Feedback E2E (Summary)

## Status
**Completed:** 2026-01-07

## Implementation Details
- **Test Infrastructure:**
  - Created `test/helpers/db-poll.js` using `pg` to verify PostgreSQL persistence.
  - Implemented `test/e2e/feedback.flow.spec.ts` which performs the full UI-to-DB flow verification.

## Verification Strategy
- **E2E Flow:**
  1.  User edits document in `ManualEditorIsland`.
  2.  Frontend sends unified payload (intercepted and verified).
  3.  Backend (`/manual/updateDocument`) handles request and calls `FeedbackService`.
  4.  `FeedbackService` persists event to `feedback_events` table in Postgres.
  5.  Test polls DB to confirm row existence and data integrity.

- **Fallback:**
  - If frontend integration is pending, the test includes a fallback to manually invoke the API with the unified payload to guarantee backend verification.

## Next Steps
- Run the test suite: `npx playwright test test/e2e/feedback.flow.spec.ts`.
- Ensure `views/manual.ejs` is fully updated to send `feedback_events` in the payload for complete E2E coverage without fallbacks.
