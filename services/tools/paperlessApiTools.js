const paperlessService = require('../paperlessService');
const logger = require('../logger');

const TOOL_DEFINITIONS = Object.freeze([
    {
        name: 'paperless.list_documents',
        description: 'List or search documents with pagination and optional filters.',
        parameters: {
            type: 'object',
            properties: {
                page: { type: 'integer', minimum: 1 },
                page_size: { type: 'integer', minimum: 1, maximum: 200 },
                query: { type: 'string' },
                more_like_id: { type: 'integer', minimum: 1 },
                custom_field_query: {
                    oneOf: [
                        { type: 'string' },
                        { type: 'array', items: { type: 'object' } }
                    ]
                },
                ordering: { type: 'string' },
                fields: { type: 'string' },
                full_perms: { type: 'boolean' }
            },
            additionalProperties: false
        }
    },
    {
        name: 'paperless.get_document',
        description: 'Get a single document by ID.',
        parameters: {
            type: 'object',
            properties: {
                document_id: { type: 'integer', minimum: 1 }
            },
            required: ['document_id'],
            additionalProperties: false
        }
    },
    {
        name: 'paperless.get_document_content',
        description: 'Get OCR/text content for a document by ID.',
        parameters: {
            type: 'object',
            properties: {
                document_id: { type: 'integer', minimum: 1 }
            },
            required: ['document_id'],
            additionalProperties: false
        }
    },
    {
        name: 'paperless.update_document',
        description: 'Patch document metadata such as title, tags, or custom fields.',
        parameters: {
            type: 'object',
            properties: {
                document_id: { type: 'integer', minimum: 1 },
                updates: { type: 'object' },
                title: { type: 'string' },
                correspondent_id: { type: 'integer', minimum: 1 },
                document_type_id: { type: 'integer', minimum: 1 },
                storage_path_id: { type: 'integer', minimum: 1 },
                created: { type: 'string' },
                tags: { type: 'array', items: { type: 'integer' } },
                custom_fields: { type: 'object' },
                owner: { type: 'integer', minimum: 1 },
                set_permissions: { type: 'object' },
                trigger_filename_reprocess: { type: 'boolean' }
            },
            required: ['document_id'],
            additionalProperties: false
        }
    },
    {
        name: 'paperless.bulk_edit_documents',
        description: 'Run a bulk edit operation on a set of documents.',
        parameters: {
            type: 'object',
            properties: {
                document_ids: { type: 'array', items: { type: 'integer' } },
                method: { type: 'string' },
                parameters: { type: 'object' }
            },
            required: ['document_ids', 'method'],
            additionalProperties: false
        }
    },
    {
        name: 'paperless.resolve_tags',
        description: 'Resolve tag names to IDs, creating tags if allowed.',
        parameters: {
            type: 'object',
            properties: {
                tag_names: {
                    oneOf: [
                        { type: 'string' },
                        { type: 'array', items: { type: 'string' } }
                    ]
                },
                restrict_to_existing: { type: 'boolean' }
            },
            required: ['tag_names'],
            additionalProperties: false
        }
    },
    {
        name: 'paperless.resolve_correspondent',
        description: 'Resolve or create a correspondent by name.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                restrict_to_existing: { type: 'boolean' }
            },
            required: ['name'],
            additionalProperties: false
        }
    },
    {
        name: 'paperless.resolve_document_type',
        description: 'Resolve or create a document type by name.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string' }
            },
            required: ['name'],
            additionalProperties: false
        }
    },
    {
        name: 'paperless.list_tags',
        description: 'List all tags with IDs.',
        parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false
        }
    },
    {
        name: 'paperless.list_correspondents',
        description: 'List all correspondents with IDs.',
        parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false
        }
    },
    {
        name: 'paperless.list_document_types',
        description: 'List all document types with IDs.',
        parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false
        }
    },
    {
        name: 'paperless.list_storage_paths',
        description: 'List storage paths with pagination.',
        parameters: {
            type: 'object',
            properties: {
                page: { type: 'integer', minimum: 1 },
                page_size: { type: 'integer', minimum: 1, maximum: 200 }
            },
            additionalProperties: false
        }
    },
    {
        name: 'paperless.rotate_documents',
        description: 'Rotate one or more documents by 90/180/270 degrees.',
        parameters: {
            type: 'object',
            properties: {
                document_ids: {
                    oneOf: [
                        { type: 'integer' },
                        { type: 'array', items: { type: 'integer' } }
                    ]
                },
                degrees: { type: 'integer', enum: [90, 180, 270] }
            },
            required: ['document_ids', 'degrees'],
            additionalProperties: false
        }
    },
    {
        name: 'paperless.reprocess_documents',
        description: 'Trigger reprocessing for one or more documents.',
        parameters: {
            type: 'object',
            properties: {
                document_ids: {
                    oneOf: [
                        { type: 'integer' },
                        { type: 'array', items: { type: 'integer' } }
                    ]
                }
            },
            required: ['document_ids'],
            additionalProperties: false
        }
    },
    {
        name: 'paperless.merge_documents',
        description: 'Merge documents using the metadata from one document.',
        parameters: {
            type: 'object',
            properties: {
                document_ids: { type: 'array', items: { type: 'integer' } },
                metadata_document_id: { type: 'integer', minimum: 1 },
                delete_originals: { type: 'boolean' }
            },
            required: ['document_ids', 'metadata_document_id'],
            additionalProperties: false
        }
    }
]);

function ensureClient() {
    paperlessService.initialize();
    if (!paperlessService.client) {
        throw new Error(
            'Paperless API client not configured. Set PAPERLESS_API_URL and PAPERLESS_API_TOKEN.'
        );
    }
    return paperlessService.client;
}

function normalizeDocumentIds(ids) {
    if (ids === undefined || ids === null) return [];
    const list = Array.isArray(ids) ? ids : [ids];
    return list.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0);
}

function buildDocumentListParams(input = {}) {
    const params = {};
    if (input.page) params.page = input.page;
    if (input.page_size) params.page_size = input.page_size;
    if (input.query) params.query = input.query;
    if (input.more_like_id) params.more_like_id = input.more_like_id;
    if (input.ordering) params.ordering = input.ordering;
    if (input.fields) params.fields = input.fields;
    if (typeof input.full_perms === 'boolean') params.full_perms = input.full_perms;
    if (input.custom_field_query) {
        params.custom_field_query = Array.isArray(input.custom_field_query)
            ? JSON.stringify(input.custom_field_query)
            : input.custom_field_query;
    }
    return params;
}

async function listDocuments(input = {}) {
    const client = ensureClient();
    const params = buildDocumentListParams(input);
    const response = await client.get('/documents/', { params });
    return response.data;
}

async function getDocument(input = {}) {
    if (!input.document_id) {
        throw new Error('document_id is required');
    }
    return paperlessService.getDocument(input.document_id);
}

async function getDocumentContent(input = {}) {
    if (!input.document_id) {
        throw new Error('document_id is required');
    }
    return paperlessService.getDocumentContent(input.document_id);
}

async function updateDocument(input = {}) {
    if (!input.document_id) {
        throw new Error('document_id is required');
    }
    const updates = { ...(input.updates || {}) };
    if (input.title !== undefined) updates.title = input.title;
    if (input.correspondent_id !== undefined) updates.correspondent = input.correspondent_id;
    if (input.document_type_id !== undefined) updates.document_type = input.document_type_id;
    if (input.storage_path_id !== undefined) updates.storage_path = input.storage_path_id;
    if (input.created !== undefined) updates.created = input.created;
    if (input.tags !== undefined) updates.tags = input.tags;
    if (input.custom_fields !== undefined) updates.custom_fields = input.custom_fields;
    if (input.owner !== undefined) updates.owner = input.owner;
    if (input.set_permissions !== undefined) updates.set_permissions = input.set_permissions;

    const options = {
        triggerFilenameReprocess: input.trigger_filename_reprocess
    };

    return paperlessService.updateDocument(input.document_id, updates, options);
}

async function bulkEditDocuments(input = {}) {
    const client = ensureClient();
    const documentIds = normalizeDocumentIds(input.document_ids);
    if (documentIds.length === 0) {
        throw new Error('document_ids is required');
    }
    if (!input.method) {
        throw new Error('method is required');
    }
    const payload = {
        documents: documentIds,
        method: input.method,
        parameters: input.parameters || {}
    };
    const response = await client.post('/documents/bulk_edit/', payload);
    return response.data;
}

async function resolveTags(input = {}) {
    const tagNames = input.tag_names;
    const restrictToExistingTags = input.restrict_to_existing;
    return paperlessService.processTags(tagNames, { restrictToExistingTags });
}

async function resolveCorrespondent(input = {}) {
    const name = String(input.name || '').trim();
    if (!name) {
        throw new Error('name is required');
    }
    return paperlessService.getOrCreateCorrespondent(name, {
        restrictToExistingCorrespondents: input.restrict_to_existing
    });
}

async function resolveDocumentType(input = {}) {
    const name = String(input.name || '').trim();
    if (!name) {
        throw new Error('name is required');
    }
    return paperlessService.getOrCreateDocumentType(name);
}

async function listTags() {
    return paperlessService.getTags();
}

async function listCorrespondents() {
    return paperlessService.listCorrespondentsNames();
}

async function listDocumentTypes() {
    return paperlessService.listDocumentTypesNames();
}

async function listStoragePaths(input = {}) {
    const client = ensureClient();
    const params = {};
    if (input.page) params.page = input.page;
    if (input.page_size) params.page_size = input.page_size;
    const response = await client.get('/storage_paths/', { params });
    return response.data;
}

async function rotateDocuments(input = {}) {
    const documentIds = normalizeDocumentIds(input.document_ids);
    if (documentIds.length === 0) {
        throw new Error('document_ids is required');
    }
    if (!input.degrees) {
        throw new Error('degrees is required');
    }
    const success = await paperlessService.rotateDocuments(documentIds, input.degrees);
    return { success, document_ids: documentIds, degrees: input.degrees };
}

async function reprocessDocuments(input = {}) {
    const documentIds = normalizeDocumentIds(input.document_ids);
    if (documentIds.length === 0) {
        throw new Error('document_ids is required');
    }
    const success = await paperlessService.reprocessDocuments(documentIds);
    return { success, document_ids: documentIds };
}

async function mergeDocuments(input = {}) {
    const documentIds = normalizeDocumentIds(input.document_ids);
    if (documentIds.length === 0) {
        throw new Error('document_ids is required');
    }
    if (!input.metadata_document_id) {
        throw new Error('metadata_document_id is required');
    }
    const success = await paperlessService.mergeDocuments(
        documentIds,
        input.metadata_document_id,
        input.delete_originals !== false
    );
    return { success, document_ids: documentIds };
}

const TOOL_HANDLERS = new Map([
    ['paperless.list_documents', listDocuments],
    ['paperless.get_document', getDocument],
    ['paperless.get_document_content', getDocumentContent],
    ['paperless.update_document', updateDocument],
    ['paperless.bulk_edit_documents', bulkEditDocuments],
    ['paperless.resolve_tags', resolveTags],
    ['paperless.resolve_correspondent', resolveCorrespondent],
    ['paperless.resolve_document_type', resolveDocumentType],
    ['paperless.list_tags', listTags],
    ['paperless.list_correspondents', listCorrespondents],
    ['paperless.list_document_types', listDocumentTypes],
    ['paperless.list_storage_paths', listStoragePaths],
    ['paperless.rotate_documents', rotateDocuments],
    ['paperless.reprocess_documents', reprocessDocuments],
    ['paperless.merge_documents', mergeDocuments]
]);

function listPaperlessTools() {
    return TOOL_DEFINITIONS.slice();
}

function getPaperlessToolDefinition(name) {
    return TOOL_DEFINITIONS.find(tool => tool.name === name) || null;
}

async function runPaperlessTool(name, input = {}) {
    const handler = TOOL_HANDLERS.get(name);
    if (!handler) {
        throw new Error(`Unknown Paperless tool: ${name}`);
    }
    return handler(input);
}

async function executePaperlessTool(name, input = {}) {
    try {
        const data = await runPaperlessTool(name, input);
        return { ok: true, tool: name, data };
    } catch (error) {
        logger.warn('[paperlessApiTools] Tool execution failed', {
            tool: name,
            error: error.message
        });
        return { ok: false, tool: name, error: error.message };
    }
}

module.exports = {
    TOOL_DEFINITIONS,
    listPaperlessTools,
    getPaperlessToolDefinition,
    runPaperlessTool,
    executePaperlessTool
};
