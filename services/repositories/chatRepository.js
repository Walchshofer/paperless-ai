const logger = require('../logger');
let Pool = null;
let pool = null;

function requireEnvFallback(key, fallbackKeys = []) {
  const val = process.env[key];
  if (val && val !== '') return val;
  for (const fk of fallbackKeys) {
    if (process.env[fk] && process.env[fk] !== '') return process.env[fk];
  }
  throw new Error(`Missing required DB env: ${key} or ${fallbackKeys.join(',')}`);
}

function getPostgresHost() {
  if (process.env.POSTGRES_HOST) return process.env.POSTGRES_HOST;
  if (process.env.PAPERLESS_DBHOST) return process.env.PAPERLESS_DBHOST;
  return 'localhost';
}

function initPool() {
  if (pool) return pool;
  try {
    const pg = require('pg');
    Pool = pg.Pool;
  } catch (e) {
    logger.warn({ event: 'postgres_module_missing', error: e.message });
    return null;
  }

  const host = getPostgresHost();
  const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
  const database = process.env.POSTGRES_DB || 'paperless';
  const user = requireEnvFallback('POSTGRES_USER', ['PAPERLESS_DBUSER']);
  const password = requireEnvFallback('POSTGRES_PASSWORD', ['PAPERLESS_DBPASS']);

  pool = new Pool({ host, port, database, user, password, max: 5 });
  pool.on('error', (err) => {
    logger.error({ event: 'postgres_pool_error', error: err.message });
  });

  return pool;
}

class ChatRepository {
  constructor(poolInstance = null) {
    this._pool = poolInstance || initPool();
  }

  async getOrCreateSession(documentId = null) {
    const p = this._pool;
    if (!p) throw new Error('DB pool not initialized');

    const client = await p.connect();
    try {
      // Try to find the latest session for documentId
      let res;
      if (documentId !== null) {
        res = await client.query('SELECT id FROM chat_sessions WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1', [documentId]);
      } else {
        res = await client.query('SELECT id FROM chat_sessions WHERE document_id IS NULL ORDER BY created_at DESC LIMIT 1');
      }

      if (res.rows.length > 0) return res.rows[0].id;

      const insertRes = await client.query('INSERT INTO chat_sessions(document_id) VALUES($1) RETURNING id', [documentId]);
      return insertRes.rows[0].id;
    } finally {
      client.release();
    }
  }

  async appendMessage(sessionId, role, content, metadata = null) {
    const p = this._pool;
    if (!p) throw new Error('DB pool not initialized');
    const client = await p.connect();
    try {
      // compute message_index
      const idxRes = await client.query('SELECT COALESCE(MAX(message_index), -1) as max_idx FROM chat_messages WHERE session_id = $1', [sessionId]);
      // Use nullish coalescing so that max_idx === 0 yields nextIndex = 1 (avoid falsy 0 -> -1) 
      const current = idxRes.rows[0].max_idx;
      const nextIndex = (current ?? -1) + 1;
      const res = await client.query('INSERT INTO chat_messages(session_id, role, content, metadata, message_index) VALUES($1,$2,$3,$4,$5) RETURNING id, created_at', [sessionId, role, content, metadata, nextIndex]);
      return { id: res.rows[0].id, created_at: res.rows[0].created_at, message_index: nextIndex };
    } finally {
      client.release();
    }
  }

  async getMessages(sessionId, limit = 100, offset = 0) {
    const p = this._pool;
    if (!p) throw new Error('DB pool not initialized');
    const client = await p.connect();
    try {
      const res = await client.query('SELECT id, role, content, metadata, message_index, created_at FROM chat_messages WHERE session_id = $1 ORDER BY message_index ASC LIMIT $2 OFFSET $3', [sessionId, limit, offset]);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async deleteThread(sessionId) {
    const p = this._pool;
    if (!p) throw new Error('DB pool not initialized');
    const client = await p.connect();
    try {
      await client.query('DELETE FROM chat_messages WHERE session_id = $1', [sessionId]);
      await client.query('DELETE FROM chat_sessions WHERE id = $1', [sessionId]);
      return true;
    } finally {
      client.release();
    }
  }
}

module.exports = new ChatRepository();
module.exports.ChatRepository = ChatRepository;
