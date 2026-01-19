/**
 * Direct test of overlay extraction to see raw model output
 * Usage: node test-overlay-direct.js [docId] [--thumbnail]
 */
const axios = require('axios');
const config = require('../../config/config');
const { pdfRenderer } = require('../../services/visual-rag-client');

const PAPERLESS_URL = 'http://localhost:8000';
const PAPERLESS_TOKEN = process.env.PAPERLESS_API_TOKEN;
const OLLAMA_URL = config.ollama?.apiUrl || 'http://localhost:11434';

async function main() {
    const docId = parseInt(process.argv[2] || '41', 10);
    const useThumbnail = process.argv.includes('--thumbnail');

    let base64;

    if (useThumbnail || !pdfRenderer.isAvailable()) {
        console.log('Fetching document thumbnail...');
        const response = await axios.get(`${PAPERLESS_URL}/api/documents/${docId}/thumb/`, {
            headers: { 'Authorization': `Token ${PAPERLESS_TOKEN}` },
            responseType: 'arraybuffer'
        });
        base64 = Buffer.from(response.data).toString('base64');
        console.log(`Thumbnail size: ${(response.data.length / 1024).toFixed(1)} KB`);
    } else {
        console.log('Downloading original PDF...');
        const pdfResponse = await axios.get(`${PAPERLESS_URL}/api/documents/${docId}/download/`, {
            headers: { 'Authorization': `Token ${PAPERLESS_TOKEN}` },
            responseType: 'arraybuffer'
        });
        const pdfBuffer = Buffer.from(pdfResponse.data);
        console.log(`PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

        console.log('Rendering at 300 DPI...');
        const rendered = await pdfRenderer.renderBuffer(pdfBuffer, { dpi: 300, docId });
        base64 = rendered[0].base64;
        console.log(`Rendered image: ${(rendered[0].size / 1024).toFixed(1)} KB (${rendered[0].format})`);
    }

    const prompt = `Analyze this document image and detect the following visual elements with their bounding box coordinates.

Elements to detect:
- Signature (handwritten signatures)
- Date (document dates, issue dates, due dates)
- Total (total amounts, sum values)
- IBAN (bank account numbers)
- Logo (company logos, letterheads)
- Stamp (official stamps, seals)
- Table (data tables, grids)
- Handwriting (any handwritten text)

For each detected element, provide:
1. label: The element type (signature, date, total, iban, logo, stamp, table, handwriting)
2. box: Bounding box coordinates as [ymin, xmin, ymax, xmax] in range 0-1000
3. confidence: Detection confidence 0.0-1.0
4. text: (optional) Any readable text within the element

Output ONLY valid JSON array. Example:
[
  {"label": "signature", "box": [850, 600, 920, 950], "confidence": 0.95},
  {"label": "date", "box": [50, 700, 80, 900], "confidence": 0.88, "text": "2024-01-15"},
  {"label": "logo", "box": [10, 10, 80, 200], "confidence": 0.92}
]

If no elements are detected, output: []`;

    console.log('\nCalling Qwen3-VL...');
    const ollamaResponse = await axios.post(`${OLLAMA_URL}/api/generate`, {
        model: config.ollama?.visionModel || 'qwen3-vl:8b',
        prompt: prompt,
        images: [base64],
        stream: false,
        options: {
            num_ctx: 8192,
            num_predict: 4096,  // Increased for complete JSON output
            temperature: 0.1
        }
    });

    console.log('\n--- RAW MODEL RESPONSE ---');
    console.log(ollamaResponse.data.response);
    console.log('\n--- END RESPONSE ---');

    // Try to parse
    const rawText = ollamaResponse.data.response || '';
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
        console.log('\nParsed JSON:');
        try {
            console.log(JSON.parse(jsonMatch[0]));
        } catch (e) {
            console.log('Failed to parse:', e.message);
        }
    } else {
        console.log('\nNo JSON array found in response');
    }
}

main().catch(console.error);
