-- Rollback for chat schema
DROP INDEX IF EXISTS idx_chat_messages_created_at;
DROP INDEX IF EXISTS idx_chat_messages_session_id;
DROP INDEX IF EXISTS idx_chat_sessions_document_id;

DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_sessions;
