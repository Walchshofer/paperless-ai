// Default to enabling Guidance to prevent JSON truncation issues.
process.env.GUIDANCE_ENABLED = process.env.GUIDANCE_ENABLED || 'true';
process.env.GUIDANCE_SERVICE_ENABLED = process.env.GUIDANCE_SERVICE_ENABLED || 'no';

// Default RAG Service URL for tests if not provided
process.env.RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

if (process.env.GUIDANCE_ENABLED === 'false' || process.env.GUIDANCE_SERVICE_ENABLED === 'no') {
    console.warn('[test] Guidance service disabled for this run.');
}

if (process.env.RAG_SERVICE_ENABLED === 'true') {
    console.log(`[test] RAG Service enabled at ${process.env.RAG_SERVICE_URL}`);
} else {
    console.log('[test] RAG Service disabled for this run.');
}
