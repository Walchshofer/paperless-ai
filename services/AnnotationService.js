const logger = require('./logger');
const path = require('path');

let Pool = null;
let pool = null;

function getPostgresHost() {
  if (process.env.POSTGRES_HOST) return process.env.POSTGRES_HOST;
  if (process.env.PAPERLESS_DBHOST) return process.env.PAPERLESS_DBHOST;
  return 'localhost';
}

function readEnvFallback(key) {
  if (process.env[key] !== undefined && process.env[key] !== '') return process.env[key];
  try {
    const envPath = path.join(process.cwd(), 'data', '.env');
    if (!require('fs').existsSync(envPath)) return undefined;
    const content = require('fs').readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const k = trimmed.substring(0, idx);
      const v = trimmed.substring(idx + 1);
      if (k === key) return v;
    }
  } catch (e) { /* ignore */ }
  return undefined;
}

function initPool() {
  if (pool) return pool;
  try {
    const pg = require('pg');
    Pool = pg.Pool;
  } catch (e) {
    logger.warn('pg module not found, PostgreSQL persistence disabled');
    return null;
  }

  const config = {
    host: getPostgresHost(),
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'paperless',
    user: readEnvFallback('POSTGRES_USER') || readEnvFallback('PAPERLESS_DBUSER'),
    password: readEnvFallback('POSTGRES_PASSWORD') || readEnvFallback('PAPERLESS_DBPASS'),
    max: parseInt(process.env.TEST_PG_MAX_CLIENTS || '10', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: parseInt(process.env.TEST_PG_CONN_TIMEOUT || '10000', 10)
  };

  pool = new Pool(config);
  pool.on('error', (err) => logger.error('PostgreSQL pool error', err));
  pool.on('connect', () => logger.debug('PostgreSQL pool connected'));
  return pool;
}

class AnnotationService {
  constructor() {
    this._pool = null;
    this._schemaEnsured = false;
    this._schemaEnsuring = null;
  }

  get pool() {
    if (!this._pool) this._pool = initPool();
    return this._pool;
  }

  async _ensureSchema() {
    if (this._schemaEnsured) return;
    if (this._schemaEnsuring) {
      await this._schemaEnsuring;
      return;
    }

    this._schemaEnsuring = (async () => {
      const activePool = this.pool;
      if (!activePool) return;
      const client = await activePool.connect();
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
        await client.query(`
          CREATE TABLE IF NOT EXISTS user_annotations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL,
            document_id INTEGER NOT NULL,
            page INTEGER NOT NULL,
            bbox JSONB NOT NULL,
            label VARCHAR(255),
            note TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_user_annotations_user_doc ON user_annotations(user_id, document_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_user_annotations_page ON user_annotations(document_id, page)');
        this._schemaEnsured = true;
      } catch (err) {
        logger.warn('annotation_schema_ensure_failed', { error: err.message });
      } finally {
        client.release();
      }
    })();

    await this._schemaEnsuring;
  }

  async saveAnnotation(userId, documentId, page, bbox, label = null, note = null) {
    await this._ensureSchema();
    const activePool = this.pool;
    if (!activePool) throw new Error('Postgres not configured');
    const client = await activePool.connect();
    try {
      const q = `INSERT INTO user_annotations (user_id, document_id, page, bbox, label, note) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
      const params = [userId, parseInt(documentId, 10), parseInt(page || 0, 10), JSON.stringify(bbox), label, note];
      const res = await client.query(q, params);
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async loadAnnotations(userId, documentId, page = null) {
    await this._ensureSchema();
    const activePool = this.pool;
    if (!activePool) return [];
    const client = await activePool.connect();
    try {
      let q = 'SELECT * FROM user_annotations WHERE user_id = $1 AND document_id = $2';
      const params = [userId, parseInt(documentId, 10)];
      if (page !== null && page !== undefined) {
        q += ' AND page = $3';
        params.push(parseInt(page, 10));
      }
      q += ' ORDER BY created_at ASC';
      const res = await client.query(q, params);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async deleteAnnotation(userId, annotationId) {
    await this._ensureSchema();
    const activePool = this.pool;
    if (!activePool) return null;
    const client = await activePool.connect();
    try {
      const check = await client.query('SELECT * FROM user_annotations WHERE id = $1', [annotationId]);
      if (check.rows.length === 0) return null;
      if (check.rows[0].user_id !== userId) throw new Error('Not authorized to delete this annotation');
      await client.query('DELETE FROM user_annotations WHERE id = $1', [annotationId]);
      return { success: true };
    } finally {
      client.release();
    }
  }

  async updateAnnotation(userId, annotationId, updates = {}) {
    await this._ensureSchema();
    const activePool = this.pool;
    if (!activePool) return null;
    const client = await activePool.connect();
    try {
      const check = await client.query('SELECT * FROM user_annotations WHERE id = $1', [annotationId]);
      if (check.rows.length === 0) return null;
      if (check.rows[0].user_id !== userId) throw new Error('Not authorized to update this annotation');

      const fields = [];
      const params = [];
      let idx = 1;
      if (updates.label !== undefined) { fields.push(`label = $${idx++}`); params.push(updates.label); }
      if (updates.note !== undefined) { fields.push(`note = $${idx++}`); params.push(updates.note); }
      if (updates.bbox !== undefined) { fields.push(`bbox = $${idx++}`); params.push(JSON.stringify(updates.bbox)); }
      if (fields.length === 0) return check.rows[0];

      const q = `UPDATE user_annotations SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
      params.push(annotationId);
      const res = await client.query(q, params);
      return res.rows[0];
    } finally {
      client.release();
    }
  }
}

module.exports = new AnnotationService();
