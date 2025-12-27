/**
 * Manual test script for Visual RAG ingestion with high-resolution PDF rendering
 *
 * Usage: node test/manual/test-visual-rag-ingestion.js [docId] [--dpi=300]
 *
 * This script:
 * 1. Fetches original PDF from paperless-ngx
 * 2. Renders pages at 300 DPI (configurable)
 * 3. Runs the dual-path ingestion (Tomoro sidecar + Qwen3-VL overlays)
 * 4. Displays the results with detected elements
 *
 * Requirements:
 * - Poppler binaries installed (for PDF rendering)
 *   Windows: https://github.com/oschwartz10612/poppler-windows/releases
 *   Linux: apt-get install poppler-utils
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

// Load config
const config = require('../../config/config');

// Visual RAG modules
const { ingestionManager, visualOverlayRepository, visualSearchClient, pdfRenderer } = require('../../services/visual-rag');

// Paperless API config
const PAPERLESS_URL = process.env.PAPERLESS_URL || 'http://localhost:8000';
const PAPERLESS_TOKEN = process.env.PAPERLESS_API_TOKEN || config.paperless?.apiToken;

// Parse command line args
function parseArgs() {
    const args = {
        docId: 9,
        dpi: 300,
        useThumbnail: false
    };

    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--dpi=')) {
            args.dpi = parseInt(arg.split('=')[1], 10);
        } else if (arg === '--thumbnail') {
            args.useThumbnail = true;
        } else if (!isNaN(parseInt(arg, 10))) {
            args.docId = parseInt(arg, 10);
        }
    }

    return args;
}

async function fetchDocument(docId) {
    console.log(`\n📄 Fetching document ${docId} from Paperless...`);

    const response = await axios.get(`${PAPERLESS_URL}/api/documents/${docId}/`, {
        headers: { 'Authorization': `Token ${PAPERLESS_TOKEN}` }
    });

    console.log(`   Title: ${response.data.title}`);
    console.log(`   Type: ${response.data.document_type}`);
    console.log(`   MIME: ${response.data.mime_type}`);
    console.log(`   Pages: ${response.data.page_count || 'N/A'}`);
    console.log(`   Original: ${response.data.original_file_name}`);

    return response.data;
}

async function downloadOriginalPdf(docId) {
    console.log(`\n📥 Downloading original PDF...`);

    const response = await axios.get(`${PAPERLESS_URL}/api/documents/${docId}/download/`, {
        headers: { 'Authorization': `Token ${PAPERLESS_TOKEN}` },
        responseType: 'arraybuffer'
    });

    const buffer = Buffer.from(response.data);
    console.log(`   PDF size: ${(buffer.length / 1024).toFixed(1)} KB`);

    return buffer;
}

async function renderPdfToImages(pdfBuffer, docId, dpi) {
    console.log(`\n🖼️  Rendering PDF at ${dpi} DPI...`);

    if (!pdfRenderer.isAvailable()) {
        console.log('   ❌ pdf-poppler not available');
        console.log('   Install poppler binaries:');
        console.log('   - Windows: https://github.com/oschwartz10612/poppler-windows/releases');
        console.log('   - Linux: apt-get install poppler-utils');
        return null;
    }

    try {
        const results = await pdfRenderer.renderBuffer(pdfBuffer, { dpi, docId });

        for (const result of results) {
            console.log(`   Page ${result.page}: ${(result.size / 1024).toFixed(1)} KB (${result.format})`);
        }

        return results.map(r => r.base64);
    } catch (error) {
        console.log(`   ❌ Rendering failed: ${error.message}`);
        return null;
    }
}

function detectImageFormat(buffer) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return 'png';
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return 'jpeg';
    }
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
        return 'webp';
    }
    return 'unknown';
}

async function fetchDocumentThumbnail(docId) {
    console.log(`\n🖼️  Fetching document thumbnail (fallback)...`);

    const response = await axios.get(`${PAPERLESS_URL}/api/documents/${docId}/thumb/`, {
        headers: { 'Authorization': `Token ${PAPERLESS_TOKEN}` },
        responseType: 'arraybuffer'
    });

    const buffer = Buffer.from(response.data);
    const format = detectImageFormat(buffer);
    const base64 = buffer.toString('base64');

    console.log(`   Thumbnail size: ${(response.data.length / 1024).toFixed(1)} KB (${format})`);

    return [base64];
}

async function checkServices() {
    console.log('\n🔍 Checking service availability...');

    // Check PDF renderer
    const rendererAvailable = pdfRenderer.isAvailable();
    console.log(`   PDF Renderer: ${rendererAvailable ? '✅ Available' : '❌ Not available (poppler not installed)'}`);

    // Check sidecar
    try {
        const available = await visualSearchClient.isAvailable();
        console.log(`   Visual Sidecar: ${available ? '✅ Available' : '⏳ Loading or unavailable'}`);
    } catch (err) {
        console.log(`   Visual Sidecar: ❌ Error - ${err.message}`);
    }

    // Check PostgreSQL
    try {
        const pgAvailable = await visualOverlayRepository.isAvailable();
        console.log(`   PostgreSQL: ${pgAvailable ? '✅ Available' : '❌ Not available'}`);
    } catch (err) {
        console.log(`   PostgreSQL: ❌ Error - ${err.message}`);
    }

    // Check Ollama (for Qwen3-VL)
    try {
        const ollamaUrl = config.ollama?.apiUrl || 'http://localhost:11434';
        const response = await axios.get(`${ollamaUrl}/api/tags`, { timeout: 5000 });
        const models = response.data.models?.map(m => m.name) || [];
        const visionModel = models.find(m => m.includes('qwen') && m.includes('vl'));
        console.log(`   Ollama: ✅ Available (${models.length} models)`);
        if (visionModel) {
            console.log(`   Vision Model: ✅ ${visionModel}`);
        }
    } catch (err) {
        console.log(`   Ollama: ❌ Error - ${err.message}`);
    }

    return rendererAvailable;
}

async function runIngestion(docId, base64Images, document) {
    console.log(`\n🚀 Running dual-path ingestion for document ${docId}...`);
    console.log(`   Images: ${base64Images.length} page(s)`);

    // Determine domain from document type/tags
    let domain = 'general';
    const content = (document.content || '').toLowerCase();
    const title = (document.title || '').toLowerCase();

    if (content.includes('labor') || content.includes('befund') || title.includes('labor')) {
        domain = 'medical';
    } else if (content.includes('rechnung') || content.includes('invoice') || content.includes('betrag')) {
        domain = 'financial';
    } else if (content.includes('vertrag') || content.includes('contract')) {
        domain = 'legal';
    }

    console.log(`   Detected domain: ${domain}`);

    const result = await ingestionManager.ingestDocument(docId, document.original_file_name, {
        domain,
        base64Images,
        metadata: {
            title: document.title,
            documentType: document.document_type,
            tags: document.tags
        }
    });

    return result;
}

async function displayResults(result, docId) {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 INGESTION RESULTS');
    console.log('═'.repeat(60));

    console.log(`\n   Duration: ${result.duration}ms`);

    // Visual Index Path
    console.log('\n   ┌─ Path 1: Visual Index (Tomoro Sidecar)');
    if (result.visualIndex?.success) {
        console.log(`   │  ✅ Success - Document indexed`);
        console.log(`   │  Status: ${result.visualIndex.status}`);
    } else if (result.visualIndex?.skipped) {
        console.log(`   │  ⏭️  Skipped: ${result.visualIndex.error}`);
    } else {
        console.log(`   │  ❌ Failed: ${result.visualIndex?.error || 'Unknown error'}`);
    }

    // Overlay Extraction Path
    console.log('\n   ├─ Path 2: Overlay Extraction (Qwen3-VL)');
    if (result.overlayExtraction?.success) {
        console.log(`   │  ✅ Success`);
        console.log(`   │  Overlays extracted: ${result.overlayExtraction.overlayCount}`);

        if (result.overlayExtraction.overlays?.length > 0) {
            console.log('   │');
            console.log('   │  Detected Elements:');
            for (const overlay of result.overlayExtraction.overlays) {
                const box = overlay.box.join(', ');
                console.log(`   │  • ${overlay.label.padEnd(12)} [${box}] (${(overlay.confidence * 100).toFixed(0)}%)`);
                if (overlay.text) {
                    console.log(`   │    └─ "${overlay.text}"`);
                }
            }
        }
    } else {
        console.log(`   │  ❌ Failed: ${result.overlayExtraction?.error || 'Unknown error'}`);
    }

    // PostgreSQL Storage
    console.log('\n   └─ PostgreSQL Storage');
    try {
        const available = await visualOverlayRepository.isAvailable();
        if (available) {
            const storedOverlays = await visualOverlayRepository.getByDocId(docId);
            console.log(`      ✅ Stored ${storedOverlays.length} overlays`);
        } else {
            console.log(`      ⚠️  Database not available`);
        }
    } catch (err) {
        console.log(`      ❌ Error: ${err.message}`);
    }

    console.log('\n' + '═'.repeat(60));
}

async function main() {
    const args = parseArgs();

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     Visual RAG Ingestion Test (High-Resolution)            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n   Document ID: ${args.docId}`);
    console.log(`   Render DPI: ${args.dpi}`);
    console.log(`   Use Thumbnail: ${args.useThumbnail}`);

    try {
        // Check services first
        const rendererAvailable = await checkServices();

        // Fetch document metadata
        const document = await fetchDocument(args.docId);

        // Get document images
        let base64Images = null;

        if (!args.useThumbnail && rendererAvailable && document.mime_type === 'application/pdf') {
            // Download and render original PDF at high resolution
            const pdfBuffer = await downloadOriginalPdf(args.docId);
            base64Images = await renderPdfToImages(pdfBuffer, args.docId, args.dpi);
        }

        if (!base64Images) {
            // Fallback to thumbnail
            console.log('\n   ⚠️  Using thumbnail as fallback (lower quality)');
            base64Images = await fetchDocumentThumbnail(args.docId);
        }

        if (!base64Images || base64Images.length === 0) {
            console.log('\n❌ No images available for this document.');
            return;
        }

        // Run ingestion
        const result = await runIngestion(args.docId, base64Images, document);

        // Display results
        await displayResults(result, args.docId);

        console.log('\n✅ Test complete!\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response?.data) {
            console.error('   Response:', JSON.stringify(error.response.data, null, 2));
        }
        console.error(error.stack);
        process.exit(1);
    }
}

main().catch(console.error);
