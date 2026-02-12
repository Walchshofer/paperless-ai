/**
 * preflight-alpha9.js
 * 
 * Simple preflight check for Alpha-9 integration services.
 * Verifies Qdrant and Sidecar availability with exponential backoff.
 */
const http = require('http');

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8001';
const TIMEOUT_MS = 60000; // 60s total timeout

async function checkUrl(url) {
  return new Promise((resolve) => {
    const fullUrl = url.endsWith('/') ? url + 'health' : url + '/health';
    http.get(fullUrl, { timeout: 2000 }, (res) => {
      // 200 is healthy, 503 is sidecar initializing (which we accept as "up" for infra check)
      resolve(res.statusCode === 200 || res.statusCode === 503);
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function run() {
  const start = Date.now();
  let attempt = 0;
  let qdrantOk = false;
  let sidecarOk = false;

  console.log(`[PREFLIGHT] Starting Alpha-9 service check (timeout: ${TIMEOUT_MS}ms)`);
  console.log(`[PREFLIGHT] Qdrant: ${QDRANT_URL}`);
  console.log(`[PREFLIGHT] Sidecar: ${SIDECAR_URL}`);

  while (Date.now() - start < TIMEOUT_MS) {
    attempt++;
    
    // Only check if not already OK
    if (!qdrantOk) qdrantOk = await checkUrl(QDRANT_URL);
    if (!sidecarOk) sidecarOk = await checkUrl(SIDECAR_URL);

    if (qdrantOk && sidecarOk) {
      console.log(`✅ [PREFLIGHT] Services ready after ${attempt} attempts (${Date.now() - start}ms)`);
      process.exit(0);
    }

    const wait = Math.min(1000 * Math.pow(1.5, attempt - 1), 5000);
    console.log(`[PREFLIGHT] Attempt #${attempt}: Qdrant=${qdrantOk ? 'OK' : 'WAIT'}, Sidecar=${sidecarOk ? 'OK' : 'WAIT'}. Retrying in ${Math.round(wait)}ms...`);
    await new Promise(resolve => setTimeout(resolve, wait));
  }

  console.error(`❌ [PREFLIGHT] Timeout reached. Services not ready.`);
  if (!qdrantOk) console.error(`   - Qdrant at ${QDRANT_URL} is UNREACHABLE`);
  if (!sidecarOk) console.error(`   - Sidecar at ${SIDECAR_URL} is UNREACHABLE`);
  process.exit(1);
}

run().catch(err => {
  console.error('[PREFLIGHT] Unexpected error:', err);
  process.exit(1);
});
