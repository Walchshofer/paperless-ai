const config = require('../../config/config');

function resolveApiUrl(apiUrlOverride) {
  if (apiUrlOverride !== undefined) {
    return apiUrlOverride;
  }

  return config?.paperless?.apiUrl || process.env.PAPERLESS_API_URL || '';
}

/**
 * Extract the Paperless base URL (without /api) from PAPERLESS_API_URL.
 * @param {string} [apiUrlOverride] - Optional API URL override for testing.
 * @returns {string|null} Base URL (e.g. http://host:8000) or null if missing.
 */
function getPaperlessBaseUrl(apiUrlOverride) {
  const apiUrl = resolveApiUrl(apiUrlOverride);
  if (!apiUrl) {
    return null;
  }

  const trimmed = String(apiUrl).trim();
  if (!trimmed) {
    return null;
  }

  const withoutApi = trimmed.replace(/\/api\/?$/, '');
  return withoutApi.replace(/\/$/, '');
}

/**
 * Build a Paperless document URL for a document and optional path suffix.
 * @param {number|string} documentId - The Paperless document ID.
 * @param {string} [pathSuffix] - Optional path suffix (e.g. "/download/").
 * @param {string} [apiUrlOverride] - Optional API URL override for testing.
 * @returns {string|null} The absolute Paperless document URL or null if missing.
 */
function buildPaperlessDocumentUrl(documentId, pathSuffix = '', apiUrlOverride) {
  const baseUrl = getPaperlessBaseUrl(apiUrlOverride);
  if (!baseUrl) {
    return null;
  }

  const docId = String(documentId || '').trim();
  if (!docId) {
    return null;
  }

  let suffix = pathSuffix ? String(pathSuffix).trim() : '';
  if (suffix && !suffix.startsWith('/')) {
    suffix = `/${suffix}`;
  }

  return `${baseUrl}/documents/${docId}${suffix}`;
}

module.exports = {
  getPaperlessBaseUrl,
  buildPaperlessDocumentUrl
};
