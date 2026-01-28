# Chat History Persistence and Schema

This file describes how chat history is persisted and the data shapes involved.

Database schema (relevant tables)
- `chat_sessions`
  - `id` (serial/uuid): primary key
  - `document_id` (nullable): the associated document id when chat is document-scoped
  - `created_at` timestamp

- `chat_messages`
  - `id` (serial/uuid)
  - `session_id` (FK -> chat_sessions.id)
  - `role` (text): one of `system`, `user`, `assistant`
  - `content` (text): message body
  - `metadata` (jsonb nullable): arbitrary metadata (e.g., { model: 'ollama', documentTitle: '...' })
  - `message_index` (int): 0-based ascending index to maintain ordering; append uses MAX(message_index)+1
  - `created_at` timestamp

Persistence behavior
- When `config.chatPersistence` === `'yes'` (or per-request option), `ChatService` will:
  - acquire or create a session via `chatRepository.getOrCreateSession(documentId)`
  - fetch existing messages via `chatRepository.getMessages(sessionId)` and seed the in-memory chat history with those messages
  - if there is no persisted history, the initial `system` message will be persisted so restarts will rehydrate the same starting prompt
  - subsequent user/assistant messages are appended using `chatRepository.appendMessage` which computes a safe `message_index` using the persisted max index (nullish-coalesced) to avoid index collisions when `max_idx` is 0

API notes
- `chatRepository.getMessages(sessionId, limit, offset)` returns rows with fields: `{ id, role, content, metadata, message_index, created_at }`
- `chatService.initializeChat(documentId, { chatPersistence: 'yes' })` returns `{ documentTitle, initialized, model, hasRagContext, history }` where `history` is an ordered array of messages hydrated from DB when persistence is enabled.

Testing & edge cases
- Unit tests simulate both the case where persisted history exists (hydrate) and where there is none (persist the system message on create).
- `appendMessage` uses `(current ?? -1) + 1` to correctly handle `current === 0`.

Operational tips
- For large histories, consider returning paginated message slices in the `/chat/init` or `/chat/history` endpoint.
- Keep `metadata` minimal if writing many messages to avoid excessive storage growth.