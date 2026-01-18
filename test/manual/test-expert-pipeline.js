/**
 * Test script for Expert Pipeline with image data
 * Tests PDF rendering and router model response
 */
const axios = require('axios');
const path = require('path');

// Resolve paths relative to the app root (parent of test/manual/)
const appRoot = path.resolve(__dirname, '../..');

async function testExpertPipeline() {
    const docId = 9; // SCN_20251219_052007.pdf - scanned PDF
    const apiUrl = process.env.PAPERLESS_API_URL || 'http://webserver:8000/api';
    const apiToken = process.env.PAPERLESS_API_TOKEN;

    console.log('=== Expert Pipeline Test ===');
    console.log('Testing document:', docId);
    console.log('API URL:', apiUrl);
    console.log('App root:', appRoot);

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

        if (!pdfRenderer.isAvailable()) {
            console.error('ERROR: PDF Renderer not available! Check poppler-utils installation.');
            process.exit(1);
        }

        // Step 3: Render PDF to images
        console.log('\n[Step 3] Rendering PDF to images...');
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

        // Step 5: Prepare document for expert pipeline
        console.log('\n[Step 5] Preparing document for Expert Pipeline...');
        // Wrap base64 in data URL format (ImagePreparator expects this)
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
        console.log('  - hasImage:', !!preparedDoc.image_data);
        console.log('  - imageDataLength:', preparedDoc.image_data?.length || 0);
        console.log('  - hasOcr:', !!preparedDoc.ocr_text);
        console.log('  - ocrLength:', preparedDoc.ocr_text?.length || 0);
        console.log('  - numImages:', preparedDoc.base64Images?.length || 0);

        // Step 6: Process with Expert Pipeline
        console.log('\n[Step 6] Running Expert Pipeline...');
        console.log('(Watch logs for router_call_start, router_raw_response, router_parsed_result)');

        const { DocumentProcessor } = require(path.join(appRoot, 'services/integration/DocumentProcessor'));
        const ollamaService = require(path.join(appRoot, 'services/ollamaService'));
        const processor = new DocumentProcessor(ollamaService);

        // Use process() method which internally routes to expert pipeline
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

testExpertPipeline();
