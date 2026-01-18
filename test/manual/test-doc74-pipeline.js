/**
 * Test Expert Pipeline on Document 74
 */
const axios = require('axios');
const path = require('path');
const appRoot = path.resolve(__dirname, '../..');

async function testDoc74() {
    const docId = 74;
    const apiUrl = process.env.PAPERLESS_API_URL || 'http://localhost:8000/api';
    const apiToken = process.env.PAPERLESS_API_TOKEN;

    console.log('=== Expert Pipeline Test: Document 74 ===');
    console.log('Testing document:', docId);
    console.log('API URL:', apiUrl);

    try {
        // Step 1: Download PDF
        console.log('\n[Step 1] Downloading PDF...');
        const response = await axios.get(
            `${apiUrl}/documents/${docId}/download/`,
            {
                headers: { 'Authorization': `Token ${apiToken}` },
                responseType: 'arraybuffer',
                timeout: 60000
            }
        );
        console.log('PDF downloaded, size:', response.data.length, 'bytes');

        // Step 2: Check PDF Renderer
        console.log('\n[Step 2] Checking PDF Renderer...');
        const { pdfRenderer } = require(path.join(appRoot, 'services/visual-rag-client/PDFRenderer'));
        console.log('PDF Renderer available:', pdfRenderer.isAvailable());

        // Step 3: Render PDF to images at 300 DPI
        console.log('\n[Step 3] Rendering PDF to images @ 300 DPI...');
        const pdfBuffer = Buffer.from(response.data);
        const images = await pdfRenderer.renderBuffer(pdfBuffer, {
            dpi: 300,
            maxPages: 2,
            docId
        });
        console.log('Rendered', images.length, 'images');
        if (images.length > 0) {
            console.log('First image base64 length:', images[0].base64.length);
        }

        // Step 4: Get document metadata
        console.log('\n[Step 4] Fetching document metadata...');
        const paperlessService = require(path.join(appRoot, 'services/paperlessService'));
        const doc = await paperlessService.getDocument(docId);
        console.log('Document title:', doc.title);
        console.log('Document content length:', doc.content?.length || 0);

        // Step 5: Prepare document
        console.log('\n[Step 5] Preparing document for Expert Pipeline...');
        const imageDataUrl = `data:image/png;base64,${images[0].base64}`;
        const preparedDoc = {
            id: docId,
            title: doc.title,
            filename: doc.original_file_name || `document-${docId}.pdf`,
            content: doc.content || '',
            ocr_text: doc.content || '',
            image_data: imageDataUrl,
            base64Images: images.map(img => `data:image/png;base64,${img.base64}`)
        };

        console.log('Prepared document:');
        console.log('  - hasImage:', Boolean(preparedDoc.image_data));
        console.log('  - imageDataLength:', preparedDoc.image_data?.length || 0);
        console.log('  - numImages:', preparedDoc.base64Images?.length || 0);

        // Step 6: Process with Expert Pipeline
        console.log('\n[Step 6] Running Expert Pipeline...');
        const { DocumentProcessor } = require(path.join(appRoot, 'services/integration/DocumentProcessor'));
        const ollamaService = require(path.join(appRoot, 'services/ollamaService'));
        const processor = new DocumentProcessor(ollamaService);

        const result = await processor.process(preparedDoc, { forceExpertPipeline: true });

        // Step 7: Display results
        console.log('\n=== Pipeline Result ===');
        console.log(JSON.stringify(result, null, 2));

        console.log('\n=== Test Complete ===');
    } catch (error) {
        console.error('Error:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

testDoc74();
