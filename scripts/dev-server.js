/* Dev server that starts the Express app without performing the DB validation step.
   Useful for local E2E runs when a full DB is not available.
*/

// Monkey-patch services BEFORE requiring the app
const paperlessService = require('../services/paperlessService');
const setupService = require('../services/setupService');
const documentModel = require('../services/documentModel');

console.log('[DEV SERVER] Mocking services for isolated run...');

// Mock PaperlessService
paperlessService.getDocument = async (id) => {
    console.log(`[MOCK] getDocument(${id})`);
    return {
        id: parseInt(id),
        title: `Mock Document ${id}`,
        content: `This is the content of document ${id}.`,
        tags: [1, 2],
        correspondent: 1,
        document_type: 1,
        created: new Date().toISOString(),
        added: new Date().toISOString(),
        archive_serial_number: null,
        original_file_name: `document_${id}.pdf`,
        archived_file_name: `document_${id}_archived.pdf`,
        page_count: 1,
        mime_type: 'application/pdf'
    };
};

paperlessService.getAllDocumentsUnfiltered = async () => {
    console.log('[MOCK] getAllDocumentsUnfiltered');
    return [
        { id: 74, title: 'Mock Document 74', original_file_name: 'doc74.pdf' },
        { id: 92, title: 'Mock Document 92', original_file_name: 'doc92.pdf' }
    ];
};

paperlessService.listCorrespondentsNames = async () => {
    return [{ id: 1, name: 'Mock Correspondent' }];
};

paperlessService.listDocumentTypesNames = async () => {
    return [{ id: 1, name: 'Mock DocType' }];
};

paperlessService.getTags = async () => {
    return [{ id: 1, name: 'Mock Tag 1' }, { id: 2, name: 'Mock Tag 2' }];
};

paperlessService.checkHealth = async () => {
    return { healthy: true, documentCount: 5, responseTime: 10 };
};

paperlessService.validateConnection = async () => {
    console.log('[MOCK] validateConnection');
    return { valid: true, details: { documentCount: 5 } };
};

paperlessService.listTagNames = async () => {
    return [{ name: 'Mock Tag 1', document_count: 1 }, { name: 'Mock Tag 2', document_count: 1 }];
};

// Mock SetupService
setupService.isConfigured = async () => true;

// Mock DocumentModel (History)
const originalGetHistory = documentModel.getHistory;
documentModel.getHistory = async (docId, username) => {
    return [{ document_id: docId, username: username || 'elfman', created_at: new Date() }];
};
documentModel.getAllHistory = async (username) => {
    return [{ document_id: 74, title: 'Mock Doc 74', created_at: new Date() }];
};

const app = require('../server');
const port = process.env.PAPERLESS_AI_PORT || 3000;

const server = app.listen(port, () => {
  const p = server.address().port;
  console.log(`[DEV SERVER] Dev server started on port ${p} (Service mocks enabled)`);
});

process.on('SIGINT', () => {
  console.log('[DEV SERVER] Shutting down');
  server.close(() => process.exit(0));
});
