/**
 * reingest_to_qdrant.js
 * 
 * Batch processes documents to migrate from pgvector to Qdrant.
 * 1. Fetches documents from Paperless-ngx API (Webserver)
 * 2. Downloads PDF content
 * 3. Triggers Visual RAG sidecar for visual indexing (PDF -> Images -> Qdrant)
 */

const { qdrantAdapter } = require('../services/visual-rag-client/QdrantAdapter');
const axios = require('axios');

// Configuration
const PAPERLESS_API_URL = process.env.PAPERLESS_API_URL || 'http://webserver:8000/api';
const PAPERLESS_API_TOKEN = process.env.PAPERLESS_API_TOKEN;
const VISUAL_RAG_URL = process.env.VISUAL_RAG_URL || 'http://localhost:8001';

async function main() {
    console.log('🚀 Starting Qdrant Migration Re-ingestion...');
    
    // 1. Initialize Qdrant
    await qdrantAdapter.initialize();
    console.log('✅ Qdrant Adapter initialized');
    
    if (!PAPERLESS_API_TOKEN) {
        console.error('❌ PAPERLESS_API_TOKEN is required');
        process.exit(1);
    }

    try {
        // 2. Fetch all documents via API (paginated)
        let nextUrl = `${PAPERLESS_API_URL}/documents/?page_size=100`;
        let totalProcessed = 0;

        while (nextUrl) {
            console.log(`\nFetching batch from: ${nextUrl}`);
            const res = await axios.get(nextUrl, {
                headers: { 'Authorization': `Token ${PAPERLESS_API_TOKEN}` }
            });
            
            const documents = res.data.results;
            nextUrl = res.data.next;

            for (const doc of documents) {
                console.log(`Processing Doc #${doc.id}: ${doc.title}`);

                try {
                    // A. Download PDF
                    const downloadUrl = `${PAPERLESS_API_URL}/documents/${doc.id}/download/`;
                    const pdfRes = await axios.get(downloadUrl, {
                        headers: { 'Authorization': `Token ${PAPERLESS_API_TOKEN}` },
                        responseType: 'arraybuffer'
                    });
                    
                    const pdfBase64 = Buffer.from(pdfRes.data, 'binary').toString('base64');

                    // B. Send to Visual RAG Sidecar (PDF -> Images @ 300 DPI -> Qdrant)
                    await axios.post(`${VISUAL_RAG_URL}/index/pdf`, {
                        doc_id: doc.id,
                        pdf_data: pdfBase64
                    });
                    
                    console.log(`  ✅ Visual Indexing Complete`);
                } catch (err) {
                    console.error(`  ❌ Failed to process doc ${doc.id}: ${err.message}`);
                }
                totalProcessed++;
            }
        }
        console.log(`\n🎉 Re-ingestion complete. Processed ${totalProcessed} documents.`);
    } catch (err) {
        console.error('❌ Migration failed:', err);
    }
}

main();