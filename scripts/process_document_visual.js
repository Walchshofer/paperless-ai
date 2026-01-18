#!/usr/bin/env node
const config = require('../config/config');
const paperlessService = require('../services/paperlessService');
const { pdfRenderer } = require('../services/visual-rag-client/PDFRenderer');
const { DocumentProcessor } = require('../services/integration/DocumentProcessor');
const { visualOverlayRepository } = require('../services/visual-rag');

// Constants
const DEFAULT_DPI = 300;
const DEFAULT_MAX_PAGES = 4;
const DEFAULT_FORMAT = 'png';
const DEFAULT_FIELD_TYPE = 'unknown';
const DEFAULT_DOMAIN = 'general';
const EXTRACTION_MODEL = 'expert-pipeline';

class ProcessingError extends Error {
  constructor(message, isOperational = true) {
    super(message);
    this.name = 'ProcessingError';
    this.isOperational = isOperational;
  }
}

async function validateDocId() {
  const docId = process.argv[2];
  if (!docId || isNaN(Number(docId))) {
    throw new ProcessingError(
      'Usage: node scripts/process_document_visual.js <docId>\nDocId must be a valid number',
      true
    );
  }
  return Number(docId);
}

async function downloadAndValidateDocument(docId) {
  const pdfBuffer = await paperlessService.downloadDocument(docId);
  if (!pdfBuffer) {
    throw new ProcessingError(
      `Failed to download document or document not found (ID: ${docId})`,
      true
    );
  }

  const doc = await paperlessService.getDocument(docId);
  if (!doc) {
    throw new ProcessingError(
      `Failed to fetch document metadata (ID: ${docId})`,
      true
    );
  }

  return { pdfBuffer, doc };
}

async function renderPDF(pdfBuffer, docId, dpi, maxPages) {
  console.log(`Rendering PDF at ${dpi} DPI (max ${maxPages} pages)`);
  
  const images = await pdfRenderer.renderBuffer(pdfBuffer, { 
    dpi, 
    docId, 
    maxPages 
  });

  if (!images || images.length === 0) {
    throw new ProcessingError(
      `No images rendered from PDF (ID: ${docId})`,
      true
    );
  }

  return images;
}

function prepareDocument(docId, doc, images) {
  const firstImage = images[0];
  
  return {
    id: docId,
    title: doc.title,
    filename: doc.original_file_name || `document-${docId}.pdf`,
    content: doc.content || '',
    ocr_text: doc.content || '',
    image_data: `data:image/${firstImage.format || DEFAULT_FORMAT};base64,${firstImage.base64}`,
    base64Images: images.map(img => 
      `data:image/${img.format || DEFAULT_FORMAT};base64,${img.base64}`
    )
  };
}

async function saveOverlays(docId, result) {
  if (!result.overlays || result.overlays.length === 0) {
    console.log('No overlays returned');
    return 0;
  }

  console.log(`Saving ${result.overlays.length} overlays to repository`);
  await visualOverlayRepository.deleteByDocId(docId);

  let count = 0;
  for (const overlay of result.overlays) {
    await visualOverlayRepository.save({
      doc_id: docId,
      page_number: overlay.page || 1,
      field_type: overlay.field_type || DEFAULT_FIELD_TYPE,
      bbox: overlay.bbox,
      raw_value: overlay.raw_value || '',
      normalized_value: overlay.normalized_value || '',
      confidence: overlay.confidence || 0,
      domain: result.domain || DEFAULT_DOMAIN,
      extraction_model: EXTRACTION_MODEL
    });
    count++;
  }

  console.log(`Saved ${count} overlays`);
  return count;
}

async function main() {
  try {
    // Validate input
    const docId = await validateDocId();
    console.log(`Processing document ${docId}...`);

    // Download and validate document
    const { pdfBuffer, doc } = await downloadAndValidateDocument(docId);

    // Get configuration with defaults
    const dpi = config.visualRag?.visionRenderDpi || DEFAULT_DPI;
    const maxPages = config.visualRag?.maxVisionPages || DEFAULT_MAX_PAGES;

    // Render PDF to images
    const images = await renderPDF(pdfBuffer, docId, dpi, maxPages);

    // Prepare document for processing
    const preparedDoc = prepareDocument(docId, doc, images);

    // Process document
    console.log('Starting expert pipeline processing...');
    const ollamaService = require('../services/ollama');
    const processor = new DocumentProcessor(ollamaService);
    
    console.log('Calling processor.process()');
    const result = await processor.process(preparedDoc, { forceExpertPipeline: true });
    console.log('processor.process() completed');
    console.log('Processing result:', JSON.stringify(result, null, 2));

    // Save overlays
    await saveOverlays(docId, result);

    console.log(`Document ${docId} processed successfully`);
  } catch (error) {
    if (error instanceof ProcessingError && error.isOperational) {
      console.error(`Processing failed: ${error.message}`);
      process.exit(1);
    } else {
      // Log unexpected errors with full stack trace
      console.error('Unexpected error during processing:', error);
      process.exit(1);
    }
  }
}

// Handle graceful shutdown
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Execute main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
