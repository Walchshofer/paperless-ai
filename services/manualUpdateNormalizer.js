const defaultPaperlessService = require('./paperlessService');
const defaultLogger = require('./logger');

async function normalizeManualUpdatePayload(rawUpdates, requestId, deps = {}) {
  const paperlessService = deps.paperlessService || defaultPaperlessService;
  const logger = deps.logger || defaultLogger;
  const updates = rawUpdates && typeof rawUpdates === 'object'
    ? { ...rawUpdates }
    : {};
  const removed = [];

  if (Object.prototype.hasOwnProperty.call(updates, 'content')) {
    delete updates.content;
    removed.push('content');
  }

  const docTypeRaw = updates.document_type ??
    updates.document_type_id ??
    updates.documentTypeId ??
    updates.documentType;
  if (docTypeRaw !== undefined && docTypeRaw !== null && docTypeRaw !== '') {
    let docTypeId = null;
    if (typeof docTypeRaw === 'object' && docTypeRaw.id) {
      docTypeId = Number(docTypeRaw.id);
    } else if (typeof docTypeRaw === 'object' && typeof docTypeRaw.name === 'string') {
      const docType = await paperlessService.getOrCreateDocumentType(docTypeRaw.name.trim());
      docTypeId = docType && docType.id ? Number(docType.id) : null;
    } else if (typeof docTypeRaw === 'string' && Number.isNaN(Number(docTypeRaw))) {
      const docType = await paperlessService.getOrCreateDocumentType(docTypeRaw.trim());
      docTypeId = docType && docType.id ? Number(docType.id) : null;
    } else {
      docTypeId = Number(docTypeRaw);
    }

    if (!docTypeId || Number.isNaN(docTypeId)) {
      const err = new Error('Invalid document_type update');
      err.statusCode = 400;
      throw err;
    }
    updates.document_type = docTypeId;
  }

  delete updates.documentType;
  delete updates.documentTypeId;
  delete updates.document_type_id;

  if (updates.correspondent !== undefined && updates.correspondent !== null) {
    const corrRaw = updates.correspondent;
    // Empty string means "no correspondent" — skip the update rather than failing
    const corrEmpty = (typeof corrRaw === 'string' && corrRaw.trim() === '') ||
      (typeof corrRaw === 'number' && corrRaw === 0);
    if (corrEmpty) {
      delete updates.correspondent;
    } else {
      let corrId = null;
      if (typeof corrRaw === 'object') {
        if (typeof corrRaw.name === 'string' && corrRaw.name.trim()) {
          const corr = await paperlessService.getOrCreateCorrespondent(corrRaw.name.trim());
          corrId = corr && corr.id ? Number(corr.id) : null;
        } else if (corrRaw.id !== undefined && corrRaw.id !== null) {
          corrId = Number(corrRaw.id);
        }
      } else if (typeof corrRaw === 'string' && Number.isNaN(Number(corrRaw))) {
        const corr = await paperlessService.getOrCreateCorrespondent(corrRaw.trim());
        corrId = corr && corr.id ? Number(corr.id) : null;
      } else {
        corrId = Number(corrRaw);
      }

      if (!corrId || Number.isNaN(corrId)) {
        const err = new Error('Invalid correspondent update');
        err.statusCode = 400;
        throw err;
      }
      updates.correspondent = corrId;
    }
  }

  if (removed.length > 0) {
    logger.debug('manual.updateDocument.removed_fields', {
      requestId,
      removed
    });
  }

  return updates;
}

module.exports = { normalizeManualUpdatePayload };
