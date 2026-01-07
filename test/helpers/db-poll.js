const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

function getPostgresHost() {
    if (process.env.POSTGRES_HOST) return process.env.POSTGRES_HOST;
    if (process.env.PAPERLESS_DBHOST) return process.env.PAPERLESS_DBHOST;
    return 'localhost';
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
 * @returns {Promise<Object|null>} - The found record or null if timed out.
 */
async function pollForFeedbackEvent(docId, eventType, timeoutMs = 5000, intervalMs = 500) {
    const pool = new Pool(config);
    const start = Date.now();
    const docIdInt = parseInt(docId, 10);

    try {
        while (Date.now() - start < timeoutMs) {
            const res = await pool.query(
                `SELECT * FROM feedback_events 
                 WHERE doc_id = $1 AND event_type = $2 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [docIdInt, eventType]
            );

            if (res.rows.length > 0) {
                return res.rows[0];
            }

            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    } catch (err) {
        console.error('Error polling feedback_events:', err);
    } finally {
        await pool.end();
    }

    return null;
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
    queryDb
};