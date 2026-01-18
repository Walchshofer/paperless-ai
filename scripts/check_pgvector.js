#!/usr/bin/env node
const { visualOverlayRepository } = require('../services/visual-rag-client/VisualOverlayRepository');

(async () => {
  try {
    console.log('Checking repository availability...');
    const available = await visualOverlayRepository.isAvailable(true);
    console.log('isAvailable:', available);

    console.log('Checking pg_vector extension...');
    const pg = await visualOverlayRepository.checkPgVectorExtension();
    console.log('pgvector:', pg);

    console.log('Ensuring enhanced schema (may log errors):');
    const schemaReady = await visualOverlayRepository.ensureEnhancedSchema();
    console.log('ensureEnhancedSchema:', schemaReady);
    process.exit(schemaReady ? 0 : 2);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();