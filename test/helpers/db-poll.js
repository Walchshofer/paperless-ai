const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
let SqliteDatabase = null;
try {
    SqliteDatabase = require('better-sqlite3');
} catch (e) {
    SqliteDatabase = null;
}

function readEnvFallback(key) {
    if (process.env[key] !== undefined && process.env[key] !== '') return process.env[key];
    try {
        const envPath = path.join(process.cwd(), 'data', '.env');
        if (!fs.existsSync(envPath)) return undefined;
        const content = fs.readFileSync(envPath, 'utf8');
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

function getPostgresHost() {
    if (process.env.POSTGRES_HOST) return process.env.POSTGRES_HOST;
    const envHost = readEnvFallback('POSTGRES_HOST') || readEnvFallback('PAPERLESS_DBHOST');
    if (envHost) return envHost;
    if (process.env.PAPERLESS_DBHOST) return process.env.PAPERLESS_DBHOST;
    return 'localhost';
}

const config = {
    host: getPostgresHost(),
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'paperless',
    user: readEnvFallback('POSTGRES_USER') || readEnvFallback('PAPERLESS_DBUSER'),
    password: readEnvFallback('POSTGRES_PASSWORD') || readEnvFallback('PAPERLESS_DBPASS'),
    max: 1, // Only need one connection for polling
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 2000
};

/**
 * Polls the PostgreSQL database for feedback events matching a specific document ID and event type.
 * @param {string|number} docId - The document ID to search for.
 * @param {string} eventType - The expected event type (e.g. 'correction', 'thumbs_up').
 * @param {number} timeoutMs - Max time to wait in ms (default 5000).
 * @param {number} intervalMs - Poll interval in ms (default 500).
 * @returns {Promise<Object>} - The found record or throws an error on timeout.
 */
async function pollForFeedbackEvent(docId, eventType, timeoutMs = 5000, intervalMs = 500) {
    // Backwards-compatible wrapper that throws on timeout (was returning null previously)
    const sqlNumeric = `SELECT * FROM feedback_events WHERE doc_id = $1 AND event_type = $2 ORDER BY created_at DESC LIMIT 1`;
    const sqlText = `SELECT * FROM feedback_events WHERE doc_id::text = $1 AND event_type = $2 ORDER BY created_at DESC LIMIT 1`;

    const isNumericId = typeof docId === 'number' || (/^\d+$/.test(String(docId)));
    const sql = isNumericId ? sqlNumeric : sqlText;
    const param = isNumericId ? parseInt(docId, 10) : String(docId);

    const row = await pollForRow({ sql, params: [param, eventType], timeoutMs, intervalMs });
    return row;
}

/**
 * Polls PostgreSQL for a single row matching a custom query condition.
 * @param {Object} opts
 * @param {string} opts.sql - SQL query that returns rows (use parameter placeholders $1..$n).
 * @param {Array} opts.params - Parameters for the query.
 * @param {number} opts.timeoutMs - Max time to wait (default 5000).
 * @param {number} opts.intervalMs - Poll interval in ms (default 500).
 * @returns {Promise<Object>} - The first matching row.
 * @throws {Error} - If no row is found within timeout or on DB error.
 */
async function pollForRow({ sql, params = [], timeoutMs = 5000, intervalMs = 500 }) {
    const pool = new Pool(config);
    const start = Date.now();

    try {
        while (Date.now() - start < timeoutMs) {
            const res = await pool.query(sql, params);
            if (res.rows.length > 0) return res.rows[0];
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        throw new Error(`Timed out after ${timeoutMs}ms waiting for DB row for query: ${sql} params=${JSON.stringify(params)}`);
    } finally {
        await pool.end();
    }
}

function getSqlitePath() {
    return path.join(process.cwd(), 'data', 'documents.db');
}

function querySqlite(sql, params = []) {
    if (!SqliteDatabase) return null;
    const dbPath = getSqlitePath();
    if (!fs.existsSync(dbPath)) return null;
    const db = new SqliteDatabase(dbPath);
    try {
        const stmt = db.prepare(sql);
        return stmt.all(...params);
    } finally {
        db.close();
    }
}

async function pollForHistoryEntry(docId, timeoutMs = 5000, intervalMs = 500) {
    const start = Date.now();
    const numericId = typeof docId === 'number' || (/^\d+$/.test(String(docId)))
        ? parseInt(docId, 10)
        : null;

    const pgSql = 'SELECT * FROM history_documents WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1';
    const sqliteSql = 'SELECT * FROM history_documents WHERE document_id = ? ORDER BY created_at DESC LIMIT 1';

    while (Date.now() - start < timeoutMs) {
        // Try Postgres first if numeric id
        if (numericId != null) {
            try {
                const row = await pollForRow({
                    sql: pgSql,
                    params: [numericId],
                    timeoutMs: intervalMs,
                    intervalMs
                });
                if (row) return row;
            } catch (e) {
                // Ignore and fall back to sqlite
            }
        }

        // SQLite fallback
        const rows = querySqlite(sqliteSql, numericId != null ? [numericId] : [String(docId)]);
        if (rows && rows.length > 0) return rows[0];

        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Timed out after ${timeoutMs}ms waiting for history entry for doc_id=${docId}`);
}

async function cleanupTestData(docId) {
    const numericId = typeof docId === 'number' || (/^\d+$/.test(String(docId)))
        ? parseInt(docId, 10)
        : null;
    const errors = [];

    if (numericId != null) {
        try {
            await queryDb('DELETE FROM feedback_events WHERE doc_id = $1', [numericId]);
        } catch (e) {
            errors.push(`pg:feedback_events:${e.message || e}`);
        }

        try {
            await queryDb('DELETE FROM history_documents WHERE document_id = $1', [numericId]);
        } catch (e) {
            errors.push(`pg:history_documents:${e.message || e}`);
        }
    }

    try {
        if (SqliteDatabase) {
            const dbPath = getSqlitePath();
            if (fs.existsSync(dbPath)) {
                const db = new SqliteDatabase(dbPath);
                try {
                    if (numericId != null) {
                        db.prepare('DELETE FROM feedback_events WHERE document_id = ?').run(numericId);
                        db.prepare('DELETE FROM history_documents WHERE document_id = ?').run(numericId);
                    }
                } finally {
                    db.close();
                }
            }
        }
    } catch (e) {
        errors.push(`sqlite:${e.message || e}`);
    }

    return { ok: errors.length === 0, errors };
}

// Check whether Postgres is reachable. Returns true if a simple 'SELECT 1' succeeds within timeout.
async function isPostgresAvailable(timeoutMs = 2000) {
    const pool = new Pool(config);
    try {
        const controller = new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs));
        const query = pool.query('SELECT 1');
        await Promise.race([controller, query]);
        return true;
    } catch (e) {
        return false;
    } finally {
        await pool.end();
    }
}

/**
 * Generic query helper for test verification.
 * @param {string} sql - SQL query.
 * @param {Array} params - Query parameters.
 * @returns {Promise<Array>} - All matching rows.
 */
async function queryDb(sql, params = []) {
    const pool = new Pool(config);
    try {
        const res = await pool.query(sql, params);
        return res.rows;
    } finally {
        await pool.end();
    }
}

module.exports = {
    pollForFeedbackEvent,
    pollForRow,
    queryDb,
    isPostgresAvailable,
    pollForHistoryEntry,
    cleanupTestData
};
