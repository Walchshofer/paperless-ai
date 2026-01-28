/* Quick DB + Qdrant connectivity diagnostic
 * Usage: node scripts/db-connect-check.js
 */
const { Pool } = require('pg');
const dotenv = require('dotenv');
const http = require('http');
const path = require('path');

// Load .env from data/.env if present
dotenv.config({ path: path.resolve(__dirname, '..', 'data', '.env') });

function tcpCheck(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = require('net').createConnection({ host, port });
    let done = false;
    socket.setTimeout(timeout);
    socket.on('connect', () => { if (!done) { done = true; socket.destroy(); resolve({ ok: true }); }});
    socket.on('error', (err) => { if (!done) { done = true; resolve({ ok: false, error: err.message }); }});
    socket.on('timeout', () => { if (!done) { done = true; socket.destroy(); resolve({ ok: false, error: 'timeout' }); }});
  });
}

async function checkPostgres() {
  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
  const database = process.env.POSTGRES_DB || 'paperless';
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || '';

  console.log('Postgres host:', host, 'port:', port, 'db:', database);
  const tcp = await tcpCheck(host, port, 3000);
  if (!tcp.ok) {
    console.error('TCP check failed for Postgres:', tcp.error);
    return { postgresTcp: tcp };
  }

  const pool = new Pool({ host, port, database, user, password, max: 1, idleTimeoutMillis: 2000, connectionTimeoutMillis: 2000 });
  try {
    const res = await pool.query('SELECT 1 AS ok');
    console.log('Postgres query result:', res.rows[0]);
    await pool.end();
    return { postgresTcp: tcp, postgresQuery: { ok: true } };
  } catch (err) {
    console.error('Postgres query failed:', err.message);
    try { await pool.end(); } catch(e){}
    return { postgresTcp: tcp, postgresQuery: { ok: false, error: err.message } };
  }
}

async function checkQdrant() {
  const defaultHost = '127.0.0.1';
  const defaultPort = 6333;
  const host = process.env.QDRANT_HOST || defaultHost;
  const port = parseInt(process.env.QDRANT_PORT || defaultPort, 10);
  const base = `http://${host}:${port}`;
  console.log('Qdrant host:', host, 'port:', port, 'base:', base);

  const tcp = await tcpCheck(host, port, 2000);
  if (!tcp.ok) {
    console.error('TCP check failed for Qdrant:', tcp.error);
    return { qdrantTcp: tcp };
  }

  // try HTTP GET /collections
  const endpoint = base + '/collections';
  return new Promise((resolve) => {
    const req = http.get(endpoint, { timeout: 2000 }, (res) => {
      let buff = '';
      res.on('data', (c) => buff += c);
      res.on('end', () => {
        console.log('Qdrant /collections status:', res.statusCode);
        resolve({ qdrantTcp: tcp, http: { status: res.statusCode, body: buff.slice(0, 1000) } });
      });
    });
    req.on('error', (err) => { console.error('Qdrant http error:', err.message); resolve({ qdrantTcp: tcp, http: { error: err.message } }); });
    req.on('timeout', () => { req.destroy(); resolve({ qdrantTcp: tcp, http: { error: 'timeout' } }); });
  });
}

async function main() {
  console.log('\n== Running DB + Qdrant checks ==');
  const pg = await checkPostgres();
  const qd = await checkQdrant();
  console.log('\n== Summary ==');
  console.log('Postgres:', JSON.stringify(pg, null, 2));
  console.log('Qdrant:', JSON.stringify(qd, null, 2));
  if (pg.postgresTcp && pg.postgresTcp.ok && pg.postgresQuery && pg.postgresQuery.ok && qd.qdrantTcp && qd.qdrantTcp.ok) {
    console.log('\nAll checks OK');
    process.exit(0);
  }
  console.error('\nOne or more checks failed');
  process.exit(2);
}

main().catch((e) => { console.error('Unexpected error:', e); process.exit(3); });
