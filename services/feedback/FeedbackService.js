/**
 * FeedbackService.js
 * * Handles user feedback collection and quality analytics.
 * Tracks extraction accuracy and model performance based on user corrections.
 * Persists data to PostgreSQL (feedback_events) and Visual Overlays.
 */

const logger = require('../logger');
const path = require('path');
const fs = require('fs').promises;
const { metricsCollector } = require('../metrics/PrometheusMetrics');
const { qdrantAdapter } = require('../visual-rag-client/QdrantAdapter');

// Lazy-load pg to allow graceful degradation
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
        /* istanbul ignore next */ 
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
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
    };

    pool = new Pool(config);
    pool.on('error', (err) => logger.error('PostgreSQL pool error', err));
    return pool;
}

class FeedbackService {
    constructor(options = {}) {
        this.feedbackDir = options.feedbackDir || path.join(process.cwd(), 'data', 'feedback');
        this._initialized = false;
        this._pool = null;
    }

    get pool() {
        if (!this._pool) this._pool = initPool();
        return this._pool;
    }

    async _init() {
        if (this._initialized) return;
        try {
            await fs.mkdir(this.feedbackDir, { recursive: true });
            this._initialized = true;
        } catch (err) {
            logger.error(`[FeedbackService] Initialization failed: ${err.message}`);
        }
    }

    /**
     * Records user feedback for a processing result (Legacy File + SQLite)
     */
    async submitFeedback(documentId, feedback) {
        await this._init();
        const record = {
            documentId,
            timestamp: new Date().toISOString(),
            pipelineId: feedback.pipelineId,
            rating: feedback.rating,
            accuracyScore: feedback.accuracyScore,
            corrections: feedback.corrections || [],
            comments: feedback.comments || '',
            metadata: feedback.metadata || {}
        };

        try {
            const fileName = `feedback_${documentId}_${Date.now()}.json`;
            const filePath = path.join(this.feedbackDir, fileName);
            await fs.writeFile(filePath, JSON.stringify(record, null, 2));

            // Attempt legacy SQLite insert
            try {
                const docModel = require('../documentModel');
                await docModel.insertFeedback({
                    doc_id: parseInt(documentId, 10),
                    user_id: null,
                    event_type: 'correction',
                    field_name: 'general_feedback',
                    original_value: null,
                    corrected_value: JSON.stringify({ rating: record.rating, accuracyScore: record.accuracyScore, corrections: record.corrections }),
                    context: JSON.stringify({ pipelineId: record.pipelineId, comments: record.comments, metadata: record.metadata })
                });
            } catch (err) {
                logger.error({ event: 'feedback_sqlite_insert_failed', error: err.message, documentId });
            }

            logger.info({ event: 'user_feedback_submitted', documentId, rating: feedback.rating });
            
            if (metricsCollector?.recordFeedback) {
                metricsCollector.recordFeedback({
                    pipelineId: feedback.pipelineId,
                    accuracyScore: record.accuracyScore,
                    corrections: record.corrections
                });
            }

            return { success: true, feedbackId: fileName };
        } catch (err) {
            logger.error(`[FeedbackService] Failed to save feedback: ${err.message}`);
            throw err;
        }
    }

    async getAnalytics() {
        // ... (Legacy analytics omitted for brevity, implementation preserved in behavior if needed, 
        // but focusing on new requirements. Keeping existing logic logic placeholder or assuming inherited?)
        // The Replace tool replaces the whole file if I provide the whole file context.
        // I will keep the existing analytics method to avoid breaking anything.
        await this._init();
        try {
            const files = await fs.readdir(this.feedbackDir);
            const records = [];
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs.readFile(path.join(this.feedbackDir, file), 'utf8');
                    records.push(JSON.parse(content));
                }
            }
            if (records.length === 0) return this._emptyStats();

            const stats = {
                totalFeedback: records.length,
                averageRating: records.reduce((acc, r) => acc + r.rating, 0) / records.length,
                averageAccuracy: records.reduce((acc, r) => acc + r.accuracyScore, 0) / records.length,
                pipelinePerformance: {},
                topCorrectionFields: {}
            };

            records.forEach(r => {
                const pId = r.pipelineId || 'unknown';
                if (!stats.pipelinePerformance[pId]) stats.pipelinePerformance[pId] = { count: 0, sumRating: 0 };
                stats.pipelinePerformance[pId].count++;
                stats.pipelinePerformance[pId].sumRating += r.rating;
                (r.corrections || []).forEach(field => {
                    stats.topCorrectionFields[field] = (stats.topCorrectionFields[field] || 0) + 1;
                });
            });
            return stats;
        } catch (err) {
            return this._emptyStats();
        }
    }

    _emptyStats() {
        return { totalFeedback: 0, averageRating: 0, averageAccuracy: 0, pipelinePerformance: {}, topCorrectionFields: {} };
    }

    /**
     * Records granular feedback to PostgreSQL (Transaction: feedback_events + visual_overlays)
     * @param {string|number} documentId
     * @param {Array} feedbackEvents
     * @param {Object} options { transactional: boolean, requestId: string }
     */
    async recordGranularFeedback(documentId, feedbackEvents = [], options = {}) {
        const start = Date.now();
        const requestId = options.requestId || 'unknown';
        const docId = parseInt(documentId, 10);

        if (!this.pool) {
            logger.error('PostgreSQL not configured, granular feedback lost');
            return { errors: [{ type: 'config_error', error: 'No database connection' }] };
        }

        // Basic payload validation
        if (!Array.isArray(feedbackEvents)) {
            const err = new Error('Invalid payload: events must be an array');
            err.statusCode = 400;
            throw err;
        }
        for (const evt of feedbackEvents) {
            if (!evt || typeof evt !== 'object') {
                const err = new Error('Each feedback event must be an object');
                err.statusCode = 400;
                throw err;
            }
            // Treat explicit null/undefined types as absent. Preserve explicit nulls in payload where intended but avoid inserting NULL into NOT NULL columns.
            const type = (evt.type !== undefined && evt.type !== null) ? evt.type : (evt.event_type || null);
            const ctx = evt.context || evt.meta || {};
            // Accept bbox either on the context or on the event payload for flexibility
            const bbox = Array.isArray(ctx.bbox) ? ctx.bbox : (Array.isArray(evt.bbox) ? evt.bbox : null);
            // Validate bbox if the event is explicitly an annotation or if a bbox was provided
            if (type === 'annotation' || bbox) {
                if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(n => typeof n === 'number')) {
                    const err = new Error('Invalid annotation: bbox must be [x,y,w,h] numeric array');
                    err.statusCode = 400;
                    throw err;
                }
            }
        }

        const results = { inserted: [], overlays: [], errors: [] };

        // Simple deterministic embedding generator for manual annotations
        const computeSimpleEmbedding = (overlayData) => {
            // 320-dimensional vector (zeros) with a few deterministic signals
            const dim = 320;
            const emb = new Array(dim).fill(0.0);
            const bbox = Array.isArray(overlayData.box) ? overlayData.box : (Array.isArray(overlayData.bbox) ? overlayData.bbox : []);
            for (let i = 0; i < Math.min(4, bbox.length); i++) {
                // Normalize bbox values modestly to avoid huge numbers in vector
                const v = Number(bbox[i]) || 0;
                emb[i] = Math.min(1e6, Math.abs(v)) / 1e6;
            }
            const label = overlayData.label || '';
            let h = 0;
            for (let i = 0; i < label.length; i++) {
                h = ((h << 5) - h) + label.charCodeAt(i);
                h |= 0;
            }
            emb[4] = (Math.abs(h) % 1000) / 1000;
            return emb;
        };

        const normalizeTagIds = (value) => {
            if (value === undefined || value === null) return [];
            const items = Array.isArray(value) ? value : [value];
            return items
                .map(item => (item && typeof item === 'object') ? item.id : item)
                .map(item => {
                    const num = Number(item);
                    return Number.isNaN(num) ? null : num;
                })
                .filter(item => item !== null);
        };

        const resolveCorrespondentId = (context, event) => {
            const value = context.correspondent_id ??
                context.correspondentId ??
                event.correspondent_id ??
                event.correspondentId ??
                event.correspondent;
            if (value === undefined || value === null) return null;
            const num = Number(value);
            return Number.isNaN(num) ? null : num;
        };

        const resolveTagIds = (context, event) => {
            const value = context.tag_ids ??
                context.tagIds ??
                context.tags ??
                event.tag_ids ??
                event.tagIds ??
                event.tags;
            return normalizeTagIds(value);
        };

        // To handle rare cases where a pooled client may be left with an aborted transaction,
        // retry the whole operation once with a fresh client if we detect the 'current transaction is aborted' state.
        const maxAttempts = 2;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Allow overriding the pool or client for testing or special cases
            const usedPool = options.pool || this.pool;
            const externalClient = options.client || null;
            const clientAllocated = !externalClient;
            const client = externalClient || await usedPool.connect();
            let clientDestroyed = false;
            try {
                await client.query('BEGIN');

                for (const evt of feedbackEvents) {
                    // Normalize payload
                    // Treat explicit null/undefined for type/fields as absent to avoid inserting NULL into NOT NULL DB columns
                    // Preserve explicit null (caller intent) when 'type' key is present; otherwise use event_type or default 'correction'
                    const eventType = ('type' in evt) ? evt.type : (evt.event_type !== undefined ? evt.event_type : 'correction');
                    const fieldName = (evt.field !== undefined && evt.field !== null) ? evt.field : (evt.field_name || null);
                    const originalValue = (evt.original !== undefined && evt.original !== null) ? evt.original : (evt.original_value !== undefined && evt.original_value !== null ? evt.original_value : null);
                    const correctedValue = (evt.corrected !== undefined && evt.corrected !== null) ? evt.corrected : (evt.corrected_value !== undefined && evt.corrected_value !== null ? evt.corrected_value : null);
                    const context = evt.context || evt.meta || {};
                    // Ensure the request id header is propagated into the stored context for auditability
                    // Do not overwrite an explicit request_id/requestId provided by the caller
                    if (!context.request_id && !context.requestId && requestId) {
                        context.request_id = requestId;
                    }
                    const userId = (evt.user_id !== undefined && evt.user_id !== null) ? evt.user_id : null;

                    // 1. Handle Visual Annotations (insert into visual_overlays)
                    if (eventType === 'annotation' || (context && context.bbox)) {
                        const bbox = Array.isArray(context.bbox) ? context.bbox : (Array.isArray(evt.bbox) ? evt.bbox : null);
                        const page = context.page || evt.page || 1;
                        const label = fieldName || context.label || 'annotation';
                        const overlayData = {
                            label,
                            box: bbox,
                            metadata: context,
                            source: 'manual'
                        };

                        // Compute a simple embedding (deterministic) - prefer ragService if available
                        let embedding = null;
                        try {
                            // If a ragService has an embedding endpoint, use it (best-effort)
                            const ragService = require('../ragService');
                            if (ragService && typeof ragService.embed === 'function') {
                                embedding = await ragService.embed(JSON.stringify(overlayData));
                            }
                        } catch (e) {
                            // ignore - fallback to simple generator below
                        }

                        if (!embedding) {
                            embedding = computeSimpleEmbedding(overlayData);
                        }

                        const overlayQuery = `
                            INSERT INTO visual_overlays (
                                doc_id,
                                page_number,
                                overlay_data,
                                semantic_label,
                                source,
                                bbox
                            )
                            VALUES ($1, $2, $3, $4, $5, $6)
                            RETURNING id
                        `;

                        const overlayResult = await client.query(overlayQuery, [
                            docId,
                            page,
                            JSON.stringify(overlayData),
                            label,
                            'manual',
                            JSON.stringify(bbox)
                        ]);

                        const overlayId = overlayResult.rows[0]?.id;
                        const correspondentId = resolveCorrespondentId(context, evt);
                        const tagIds = resolveTagIds(context, evt);

                        if (qdrantAdapter && Array.isArray(embedding)) {
                            // Use deterministic UUID for Qdrant point id so we can mirror vector_id into Postgres
                            const { randomUUID } = require('crypto');
                            const vectorId = randomUUID();

                            const qdrantPoint = {
                                id: vectorId,
                                vector: embedding,
                                payload: {
                                    doc_id: docId,
                                    correspondent_id: correspondentId,
                                    tag_ids: tagIds,
                                    page_number: page,
                                    semantic_label: label
                                }
                            };

                            // Retry logic to handle sidecar warming up (503 Initializing)
                            const maxQdrantAttempts = 3;
                            let qdrantSuccess = false;
                            let qdrantLastErr = null;
                            for (let qAttempt = 1; qAttempt <= maxQdrantAttempts; qAttempt++) {
                                try {
                                    await qdrantAdapter.upsertVisualOverlays([qdrantPoint]);
                                    qdrantSuccess = true;
                                    break;
                                } catch (qdrantErr) {
                                    qdrantLastErr = qdrantErr;
                                    const msg = (qdrantErr && qdrantErr.message) ? qdrantErr.message.toLowerCase() : '';
                                    logger.warn('qdrant_overlay_upsert_failed', {
                                        requestId,
                                        documentId: docId,
                                        attempt: qAttempt,
                                        error: qdrantErr.message,
                                        hardware_target: 'RTX 3090 Ti'
                                    });

                                    // If it's an initializing 503, wait and retry; otherwise break
                                    if (msg.includes('503') || msg.includes('initializ')) {
                                        // exponential backoff (ms)
                                        const waitMs = 500 * Math.pow(2, qAttempt - 1);
                                        await new Promise(res => setTimeout(res, waitMs));
                                        continue;
                                    }

                                    break;
                                }
                            }

                            if (qdrantSuccess) {
                                try {
                                    // Mirror vector_id into Postgres visual_overlays
                                    const updateRes = await client.query(`UPDATE visual_overlays SET vector_id = $1 WHERE id = $2 RETURNING vector_id`, [vectorId, overlayId]);
                                    const setVectorId = updateRes.rows[0] && updateRes.rows[0].vector_id;
                                    logger.info('qdrant_overlay_upserted', { requestId, documentId: docId, overlayId, vectorId: setVectorId, hardware_target: 'RTX 3090 Ti' });
                                } catch (dbErr) {
                                    logger.warn('visual_overlay_vector_id_update_failed', { requestId, documentId: docId, overlayId, error: dbErr.message });
                                }
                            } else {
                                // After retries failed, mark event for deferred ingestion
                                logger.error('qdrant_overlay_deferred', { requestId, documentId: docId, overlayId, error: qdrantLastErr && qdrantLastErr.message, hardware_target: 'RTX 3090 Ti' });

                                // Insert a feedback_events entry to track deferred ingestion for auditing
                                try {
                                    await client.query(`INSERT INTO feedback_events (doc_id, user_id, event_type, field_name, original_value, corrected_value, context) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
                                        docId,
                                        userId,
                                        'deferred_ingest',
                                        'visual_overlay',
                                        null,
                                        JSON.stringify({ overlayId, attempted_point: qdrantPoint }),
                                        JSON.stringify({ deferred: true, hardware_target: 'RTX 3090 Ti' })
                                    ]);
                                    // Surface to response for visibility
                                    results.errors.push({ type: 'deferred_ingest', overlayId, error: qdrantLastErr && qdrantLastErr.message });
                                } catch (insertErr) {
                                    logger.error('deferred_ingest_record_failed', { requestId, documentId: docId, error: insertErr.message });
                                    results.errors.push({ type: 'deferred_ingest_record_failed', overlayId, error: insertErr.message });
                                }
                            }
                        }

                        results.overlays.push({ label, page });
                    }

                    // 2. Handle Feedback Event (insert into feedback_events)
                    // For visual annotations we generally store overlays only; to avoid duplicate records we skip creating a feedback_event for
                    // annotation events when the operation is running transactionally (e.g., combined feedback + overlays in a single transaction).
                    // Standalone/non-transactional calls should still create a feedback_event for annotations to support audit/ingest workflows.
                    const shouldInsertEvent = !(eventType === 'annotation' && options && options.transactional);
                    if (shouldInsertEvent) {
                        const eventQuery = `
                            INSERT INTO feedback_events (doc_id, user_id, event_type, field_name, original_value, corrected_value, context)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                            RETURNING id
                        `;
                        const evtRes = await client.query(eventQuery, [
                            docId,
                            userId,
                            eventType,
                            fieldName,
                            originalValue != null ? JSON.stringify(originalValue) : null,
                            correctedValue != null ? JSON.stringify(correctedValue) : null,
                            context != null ? JSON.stringify(context) : null
                        ]);
                        results.inserted.push(evtRes.rows[0].id);
                    }
                }

                await client.query('COMMIT');

                const duration = Date.now() - start;
                if (metricsCollector && metricsCollector.recordStageLatency) {
                    metricsCollector.recordStageLatency('feedback_ingest', 'integration', duration);
                }

                logger.info('feedback_ingest_completed', {
                    requestId,
                    documentId: docId,
                    inserted: results.inserted.length,
                    overlays: results.overlays.length,
                    duration,
                    hardware_target: 'RTX 3090 Ti'
                });

                // Release and return when successful
                try { client.release(); } catch (e) { /* ignore */ }
                return results;

            } catch (err) {
                let rollbackErr = null;
                try {
                    await client.query('ROLLBACK');
                } catch (rbErr) {
                    rollbackErr = rbErr;
                    // If rollback itself fails, log and proceed to destroy the client to avoid leaving an aborted connection in the pool
                    logger.error('rollback_failed', { requestId, documentId: docId, error: rbErr.message });
                }

                logger.error('recordGranularFeedback_failed', { requestId, documentId: docId, error: err.message, stack: err && err.stack });
                if (metricsCollector && metricsCollector.recordIntegrationError) {
                    metricsCollector.recordIntegrationError('feedback_ingest');
                }

                // If this looks like an aborted-transaction from a bad pooled client, destroy and retry once
                const msg = err && err.message ? err.message : '';
                const isAborted = /current transaction is aborted/i.test(msg);

                // Save the error for later diagnostics
                err._destroyClient = true;
                if (rollbackErr) err._rollbackError = rollbackErr;

                // Destroy this potentially bad client so the pool doesn't reuse it
                try {
                    client.release(new Error('destroying-due-to-error'));
                } catch (releaseErr) {
                    logger.warn('client_release_failed', { requestId, documentId: docId, error: releaseErr && releaseErr.message });
                }
                try {
                    if (client && typeof client.end === 'function') await client.end();
                } catch (endErr) {
                    logger.warn('client_end_failed', { requestId, documentId: docId, error: endErr && endErr.message });
                }
                // mark as destroyed so finally block doesn't attempt a double-release
                clientDestroyed = true;

                if (isAborted && attempt < maxAttempts) {
                    logger.info('recordGranularFeedback_retrying', { requestId, documentId: docId, attempt: attempt + 1 });
                    // Try again with a fresh client
                    continue;
                }

                if (options.transactional) throw err;
                return { inserted: [], overlays: [], errors: [{ type: 'transaction_failed', error: err.message }] };
            } finally {
                // Ensure we attempt to release client if not already destroyed and only if we allocated it here
                try { if (clientAllocated && !clientDestroyed && client && client.release) client.release(); } catch (e) { /* ignore */ }
            }
        }
    }

    /**
     * Process deferred feedback events (background job)
     * Replays Qdrant upserts for events marked 'deferred_ingest'
     */
    async processDeferredFeedback() {
        if (!this.pool) return 0;

        const client = await this.pool.connect();
        let processedCount = 0;

        try {
            // Fetch pending deferred events
            const res = await client.query(`
                SELECT id, doc_id, corrected_value 
                FROM feedback_events 
                WHERE event_type = 'deferred_ingest' 
                ORDER BY created_at ASC
                LIMIT 50
            `);

            for (const row of res.rows) {
                try {
                    let data = row.corrected_value;
                    if (typeof data === 'string') {
                        try {
                            data = JSON.parse(data);
                        } catch (e) {
                            logger.warn('deferred_feedback_parse_error', { eventId: row.id });
                            continue;
                        }
                    }

                    if (!data || !data.attempted_point) continue;

                    const { overlayId, attempted_point } = data;

                    // Attempt upsert via qdrantAdapter
                    if (qdrantAdapter) {
                        await qdrantAdapter.upsertVisualOverlays([attempted_point]);

                        // On success, update visual_overlays vector_id if overlayId is present
                        if (overlayId && attempted_point.id) {
                            await client.query(
                                `UPDATE visual_overlays SET vector_id = $1 WHERE id = $2`,
                                [attempted_point.id, overlayId]
                            );
                        }

                        // Mark event as resolved
                        await client.query(
                            `UPDATE feedback_events 
                             SET event_type = 'deferred_ingest_resolved', 
                                 context = jsonb_set(COALESCE(context, '{}'::jsonb), '{resolved_at}', to_jsonb(NOW())) 
                             WHERE id = $1`,
                            [row.id]
                        );

                        processedCount++;
                    }
                } catch (err) {
                    logger.warn('deferred_feedback_processing_failed', { eventId: row.id, error: err.message });
                }
            }

            if (processedCount > 0) {
                logger.info('deferred_feedback_processed', { count: processedCount });
            }
        } catch (err) {
            logger.error('process_deferred_feedback_error', { error: err.message });
        } finally {
            client.release();
        }

        return processedCount;
    }
}

module.exports = new FeedbackService();
