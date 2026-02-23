// services/paperlessService.js
const axios = require('axios');
const config = require('../config/config');
const { parse, isValid, parseISO, format } = require('date-fns');
const FieldMatcher = require('./FieldMatcher');
const logger = require('./logger');
const { normalizeCustomFieldValue } = require('./customFieldUtils');
const { getPaperlessBaseUrl } = require('./utils/paperlessUrl');

class PaperlessService {
  constructor() {
    this.client = null;
    this.tagCache = new Map();
    this.customFieldCache = new Map();
    this.fieldMatcher = null;
    this.lastTagRefresh = 0;
    this.lastCustomFieldRefresh = 0;
    this.CACHE_LIFETIME = 3000; // 3 seconds
    this.lastAuthCheck = 0;
    this.AUTH_CHECK_INTERVAL = 60000; // Re-validate auth every 60 seconds
  }

  /**
   * Validate response is not HTML/JSON error (auth failure)
   * @private
   */
  _validateBinaryResponse(buffer, context = '') {
    const apiUrl = config.paperless?.apiUrl || process.env.PAPERLESS_API_URL || null;
    const baseUrl = getPaperlessBaseUrl(apiUrl);
    const logContext = {
      context: context || null,
      apiUrl,
      baseUrl
    };

    if (!buffer || buffer.length === 0) {
      logger.warn(
        '[PAPERLESS] Empty binary response received',
        {
          ...logContext,
          code: 'NETWORK_ERROR',
          suggestion: 'Check Paperless API reachability and container network connectivity.'
        }
      );
      return { valid: false, reason: 'empty_buffer', code: 'NETWORK_ERROR' };
    }

    // Check for HTML response (login page)
    const header = buffer.slice(0, 15).toString('utf8').toLowerCase();
    if (header.includes('<!doctype') || header.includes('<html')) {
      logger.warn(
        `[PAPERLESS] Received HTML instead of binary data${context ? ' for ' + context : ''}`,
        {
          ...logContext,
          code: 'AUTH_FAILURE',
          suggestion: 'Verify PAPERLESS_API_TOKEN and ensure PAPERLESS_API_URL ends with /api.'
        }
      );
      return { valid: false, reason: 'html_response', code: 'AUTH_FAILURE' };
    }

    // Check for JSON error response
    if (buffer[0] === 0x7B) { // '{' character
      try {
        const text = buffer.toString('utf8');
        const json = JSON.parse(text);
        if (json.error || json.detail) {
          const detail = String(json.error || json.detail || '').toLowerCase();
          const authHints = ['authentication', 'credentials', 'token', 'permission', 'forbidden', 'unauthorized'];
          const isAuth = authHints.some(hint => detail.includes(hint));
          const code = isAuth ? 'AUTH_FAILURE' : 'WRONG_URL';
          const suggestion = isAuth
            ? 'Check PAPERLESS_API_TOKEN permissions and validity.'
            : 'Verify PAPERLESS_API_URL and document ID; ensure the API endpoint exists.';
          logger.warn(
            `[PAPERLESS] Received JSON error${context ? ' for ' + context : ''}: ${json.error || json.detail}`,
            {
              ...logContext,
              code,
              suggestion,
              error: json
            }
          );
          return { valid: false, reason: 'json_error', code, error: json };
        }
      } catch (e) {
        // Not JSON, continue
      }
    }

    return { valid: true };
  }

  /**
   * Reset client to force re-initialization (useful after auth failures)
   */
  resetClient() {
    logger.info('[PAPERLESS] Resetting client connection');
    this.client = null;
    this.lastAuthCheck = 0;
  }

  async validateConnection() {
    this.initialize();
    const apiUrl = config.paperless?.apiUrl || process.env.PAPERLESS_API_URL || null;
    const baseUrl = getPaperlessBaseUrl(apiUrl);
    const apiToken = config.paperless?.apiToken || process.env.PAPERLESS_API_TOKEN || null;

    if (!this.client) {
      return {
        valid: false,
        error: 'Client not initialized',
        details: {
          apiUrlSet: !!apiUrl,
          apiTokenSet: !!apiToken,
          apiUrl,
          baseUrl
        }
      };
    }

    const start = Date.now();
    try {
      const response = await this.client.get('documents/?page_size=1', {
        timeout: 5000
      });
      const responseTimeMs = Date.now() - start;
      const data = response?.data;

      if (!data || typeof data !== 'object') {
        return {
          valid: false,
          error: 'Invalid API response',
          details: { responseTimeMs, apiUrl, baseUrl }
        };
      }

      return {
        valid: true,
        details: {
          responseTimeMs,
          documentCount: data.count,
          apiUrl,
          baseUrl
        }
      };
    } catch (error) {
      const responseTimeMs = Date.now() - start;
      const status = error.response?.status || null;
      const networkCode = error.code || null;
      let code = 'NETWORK_ERROR';
      let message = 'Cannot reach Paperless API';

      if (status === 401 || status === 403) {
        code = 'AUTH_FAILURE';
        message = 'Invalid API token';
      } else if (status === 404) {
        code = 'WRONG_URL';
        message = 'Cannot reach Paperless API';
      }

      return {
        valid: false,
        error: message,
        details: {
          status,
          code,
          networkCode,
          responseTimeMs,
          apiUrl,
          baseUrl,
          message: error.message
        }
      };
    }
  }

  initialize() {
    if (!this.client) {
      let apiUrl = config.paperless?.apiUrl || process.env.PAPERLESS_API_URL;
      let apiToken = config.paperless?.apiToken || process.env.PAPERLESS_API_TOKEN;
      if (!apiUrl || !apiToken) {
        console.error(
          '[PaperlessService] Missing PAPERLESS_API_URL or '
          + 'PAPERLESS_API_TOKEN. Configure docker-compose.env.'
        );
        return;
      }

      const baseApiUrl = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
      this.client = axios.create({
        baseURL: baseApiUrl,
        headers: {
          'Authorization': `Token ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });
    }
  }

  async getAllDocumentsUnfiltered() {
    this.initialize();
    if (!this.client) return [];
    let documents = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      try {
        const response = await this.client.get('documents/', {
          params: { page, page_size: 100, fields: 'id,title,created,created_date,added,tags,correspondent,mime_type,page_count' }
        });
        if (!response?.data?.results) break;
        documents = documents.concat(response.data.results);
        hasMore = response.data.next !== null;
        page++;
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        break;
      }
    }
    return documents;
  }

  async getAllDocuments() {
    const shouldFilterByTags = process.env.PROCESS_PREDEFINED_DOCUMENTS === 'yes';
    if (!shouldFilterByTags) return this.getAllDocumentsUnfiltered();

    this.initialize();
    if (!this.client) return [];

    let documents = [];
    let page = 1;
    let hasMore = true;
    let tagIds = [];

    if (!process.env.TAGS) {
        logger.warn('PROCESS_PREDEFINED_DOCUMENTS is set to yes but no TAGS are defined');
        return [];
    }

    const tagNames = process.env.TAGS.split(',').map(tag => tag.trim());
    await this.ensureTagCache();

    for (const tagName of tagNames) {
        const tag = await this.findExistingTag(tagName);
        if (tag) tagIds.push(tag.id);
    }

    if (tagIds.length === 0) {
        logger.warn('None of the specified tags were found');
        return [];
    }

    while (hasMore) {
      try {
        const params = {
          page,
          page_size: 100,
          fields: 'id,title,created,created_date,added,tags,correspondent,mime_type,page_count',
          tags__id__in: tagIds.join(',')
        };

        const response = await this.client.get('documents/', { params });
        if (!response?.data?.results) break;
        documents = documents.concat(response.data.results);
        hasMore = response.data.next !== null;
        page++;
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        break;
      }
    }
    return documents;
  }

  async getDocument(documentId) {
    this.initialize();
    try {
      const response = await this.client.get(`documents/${documentId}/`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getDocumentMetadata(documentId) {
    this.initialize();
    try {
      const doc = await this.getDocument(documentId);
      if (!doc) return null;
      return {
        id: doc.id,
        title: doc.title,
        mime_type: doc.mime_type,
        original_file_name: doc.original_file_name,
        page_count: doc.page_count || 1,
        tags: doc.tags || [],
        correspondent: doc.correspondent
      };
    } catch (error) {
      return null;
    }
  }

  async downloadDocument(documentId, retryCount = 0) {
    this.initialize();
    if (!this.client) return null;
    try {
      const response = await this.client.get(`documents/${documentId}/download/`, {
        responseType: 'arraybuffer',
        headers: {
          'Accept': '*/*'
        }
      });
      if (!response?.data) return null;
      const buffer = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
      const validation = this._validateBinaryResponse(buffer, `document ${documentId}`);
      if (!validation.valid) {
        if (validation.reason === 'html_response' && retryCount === 0) {
          this.resetClient();
          return this.downloadDocument(documentId, retryCount + 1);
        }
        return null;
      }
      return buffer;
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) this.resetClient();
      return null;
    }
  }

  async getThumbnailImage(documentId) {
    this.initialize();
    try {
      const response = await this.client.get(`documents/${documentId}/thumb/`, {
        responseType: 'arraybuffer'
      });
      if (response.data && response.data.byteLength > 0) return Buffer.from(response.data);
      return null;
    } catch (error) {
      return null;
    }
  }

  async getDocumentPageImages(documentId) {
    this.initialize();
    const pageImages = [];
    try {
      const docMeta = await this.getDocumentMetadata(documentId);
      const pageCount = Number.isInteger(docMeta?.page_count)
        ? docMeta.page_count
        : 1;
      const maxPages = config.duplicateDetection?.maxPagesToCompare || 10;
      const pagesToFetch = Math.min(pageCount, maxPages);
      for (let page = 1; page <= pagesToFetch; page++) {
        try {
          const response = await this.client.get(`documents/${documentId}/preview/`, {
            params: { page },
            responseType: 'arraybuffer',
            timeout: 30000
          });
          pageImages.push(Buffer.from(response.data));
        } catch (error) {
          logger.debug({
            event: 'paperless_preview_page_fetch_failed',
            documentId,
            page,
            error: error.message
          });
        }
      }

      if (pageImages.length === 0) {
        try {
          const response = await this.client.get(`documents/${documentId}/preview/`, {
            responseType: 'arraybuffer',
            timeout: 30000
          });
          if (response?.data) {
            pageImages.push(Buffer.from(response.data));
          }
        } catch (error) {
          logger.debug({
            event: 'paperless_preview_default_fetch_failed',
            documentId,
            error: error.message
          });
        }
      }
      return pageImages;
    } catch (error) {
      return [];
    }
  }

  async addTagToDocument(documentId, tagName) {
    try {
      const { tagIds } = await this.processTags([tagName]);
      if (!tagIds || tagIds.length === 0) return false;
      await this.updateDocument(documentId, { tags: tagIds });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getTagIdByName(tagName) {
    this.initialize();
    if (!tagName) return null;
    try {
      await this.ensureTagCache();
      const tag = await this.findExistingTag(tagName);
      return tag?.id || null;
    } catch (error) {
      return null;
    }
  }

  async removeTagFromDocument(documentId, tagId) {
    this.initialize();
    if (!this.client) return false;
    try {
      const currentDoc = await this.getDocument(documentId);
      if (!currentDoc?.tags) return false;
      const remainingTags = currentDoc.tags.filter(id => id !== tagId);
      await this.client.patch(`documents/${documentId}/`, { tags: remainingTags });
      return true;
    } catch (error) {
      return false;
    }
  }

  async setStoragePath(documentId, storagePathId) {
    this.initialize();
    if (!this.client) return false;
    try {
      await this.client.patch(`documents/${documentId}/`, { storage_path: storagePathId });
      return true;
    } catch (error) {
      return false;
    }
  }

  async mergeDocuments(documentIds, metadataDocumentId, deleteOriginals = true) {
    this.initialize();
    if (!this.client) return false;
    try {
      const payload = {
        documents: documentIds,
        method: 'merge',
        parameters: { metadata_document_id: metadataDocumentId, delete_originals: !!deleteOriginals }
      };
      await this.client.post('documents/bulk_edit/', payload);
      return true;
    } catch (error) {
      return false;
    }
  }

  async rotateDocuments(documentIds, degrees) {
    this.initialize();
    if (!this.client) return false;
    const ids = Array.isArray(documentIds) ? documentIds : [documentIds];
    const filtered = ids.map(id => Number(id)).filter(id => Number.isInteger(id));
    if (filtered.length === 0) return false;
    const rotation = Number.parseInt(degrees, 10);
    if (![0, 90, 180, 270].includes(rotation)) return false;
    if (rotation === 0) return true;
    try {
      await this.client.post('documents/bulk_edit/', {
        documents: filtered,
        method: 'rotate',
        parameters: { degrees: rotation }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async addNoteToDocument(documentId, note) {
    this.initialize();
    try {
      await this.client.post(`documents/${documentId}/notes/`, { note });
    } catch (error) {}
  }

  async ensureTagCache() {
    const now = Date.now();
    if (this.tagCache.size === 0 || (now - this.lastTagRefresh) > this.CACHE_LIFETIME) {
      await this.refreshTagCache();
    }
  }

  async ensureCustomFieldCache() {
    const now = Date.now();
    if (this.customFieldCache.size === 0 || (now - this.lastCustomFieldRefresh) > this.CACHE_LIFETIME) {
      await this.refreshCustomFieldCache();
    }
  }

  _refreshFieldMatcher() {
    this.fieldMatcher = new FieldMatcher([...this.customFieldCache.values()]);
  }

  async refreshTagCache() {
    try {
      this.tagCache.clear();
      let nextUrl = 'tags/';
      while (nextUrl) {
        const response = await this.client.get(nextUrl);
        if (!response?.data?.results) break;
        response.data.results.forEach(tag => this.tagCache.set(tag.name.toLowerCase(), tag));
        if (response.data.next) {
          try {
            const nextUrlObj = new URL(response.data.next);
            const baseUrlObj = new URL(this.client.defaults.baseURL);
            let relativePath = nextUrlObj.pathname;
            if (baseUrlObj.pathname && baseUrlObj.pathname !== '/') relativePath = relativePath.replace(baseUrlObj.pathname, '');
            if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
            nextUrl = relativePath + nextUrlObj.search;
          } catch (e) { nextUrl = null; }
        } else nextUrl = null;
      }
      this.lastTagRefresh = Date.now();
    } catch (error) {}
  }

  async getTags() {
    this.initialize();
    await this.ensureTagCache();
    return Array.from(this.tagCache.values());
  }

  async createCustomFieldSafely(fieldName, fieldType, default_currency) {
    this.initialize();
    try {
      const response = await this.client.post('custom_fields/', { 
        name: fieldName,
        data_type: fieldType,
        extra_data: { default_currency: default_currency || null }
      });
      const newField = response.data;
      this.customFieldCache.set(fieldName.toLowerCase(), newField);
      this._refreshFieldMatcher();
      return newField;
    } catch (error) {
      if (error.response?.status === 400) {
        await this.refreshCustomFieldCache();
        return await this.findExistingCustomField(fieldName);
      }
      return null;
    }
  }

  async getExistingCustomFields(documentId) {
    this.initialize();
    try {
      const response = await this.client.get(`documents/${documentId}/`);
      return response.data.custom_fields || [];
    } catch (error) {
      return [];
    }
  }
  
  async findExistingCustomField(fieldName) {
    const normalizedName = fieldName.toLowerCase();
    await this.ensureCustomFieldCache();
    const cachedField = this.customFieldCache.get(normalizedName);
    if (cachedField) return cachedField;
    if (this.fieldMatcher) {
      const match = await this.fieldMatcher.findBestMatch(fieldName);
      if (match?.field) {
        this.customFieldCache.set(match.field.name.toLowerCase(), match.field);
        return match.field;
      }
    }
    return null;
  }

  async refreshCustomFieldCache() {
    try {
      this.customFieldCache.clear();
      let nextUrl = 'custom_fields/';
      while (nextUrl) {
        const response = await this.client.get(nextUrl);
        if (!response?.data?.results) break;
        response.data.results.forEach(field => this.customFieldCache.set(field.name.toLowerCase(), field));
        if (response.data.next) {
          try {
            const nextUrlObj = new URL(response.data.next);
            const baseUrlObj = new URL(this.client.defaults.baseURL);
            let relativePath = nextUrlObj.pathname;
            if (baseUrlObj.pathname && baseUrlObj.pathname !== '/') relativePath = relativePath.replace(baseUrlObj.pathname, '');
            if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
            nextUrl = relativePath + nextUrlObj.search;
          } catch (e) { nextUrl = null; }
        } else nextUrl = null;
      }
      this._refreshFieldMatcher();
      this.lastCustomFieldRefresh = Date.now();
    } catch (error) {}
  }

  async listCustomFields() {
    this.initialize();
    await this.ensureCustomFieldCache();
    return Array.from(this.customFieldCache.values());
  }

  async findExistingTag(tagName) {
    const normalizedName = tagName.toLowerCase();
    const cachedTag = this.tagCache.get(normalizedName);
    if (cachedTag) return cachedTag;
    try {
      const response = await this.client.get('tags/', { params: { name__iexact: normalizedName } });
      if (response.data.results.length > 0) {
        const foundTag = response.data.results[0];
        this.tagCache.set(normalizedName, foundTag);
        return foundTag;
      }
    } catch (error) {}
    return null;
  }

  async createTagSafely(tagName) {
    try {
      const response = await this.client.post('tags/', { name: tagName });
      const newTag = response.data;
      this.tagCache.set(tagName.toLowerCase(), newTag);
      return newTag;
    } catch (error) {
      if (error.response?.status === 400) {
        await this.refreshTagCache();
        return await this.findExistingTag(tagName);
      }
      throw error;
    }
  }

  async processTags(tagNames, options = {}) {
    try {
      this.initialize();
      await this.ensureTagCache();
      const restrictToExistingTags = options.restrictToExistingTags === true || 
                                   (options.restrictToExistingTags === undefined && 
                                    process.env.RESTRICT_TO_EXISTING_TAGS === 'yes');
      const tagsArray = Array.isArray(tagNames) ? tagNames : (typeof tagNames === 'string' ? [tagNames] : []);
      if (tagsArray.length === 0) return { tagIds: [], errors: [] };
      const tagIds = [];
      const errors = [];
      const processedTags = new Set();
      for (const tagName of tagsArray) {
        if (!tagName || typeof tagName !== 'string') continue;
        const normalizedName = tagName.toLowerCase().trim();
        if (!normalizedName || processedTags.has(normalizedName)) continue;
        try {
          let tag = await this.findExistingTag(tagName);
          if (!tag && !restrictToExistingTags) tag = await this.createTagSafely(tagName);
          if (tag && tag.id) {
            tagIds.push(tag.id);
            processedTags.add(normalizedName);
          }
        } catch (error) { errors.push({ tagName, error: error.message }); }
      }
      return { tagIds: [...new Set(tagIds)], errors };      
    } catch (error) { throw new Error(`Failed to process tags: ${error.message}`); }
  }

  async getDocumentContent(documentId) {
    this.initialize();
    const response = await this.client.get(`documents/${documentId}/`);
    return response.data.content;
  }

  async updateDocument(documentId, updates, options = { triggerFilenameReprocess: true, requestId: null, overwrite: false }) {
    this.initialize();
    if (!this.client) return;
    try {
      const currentDoc = await this.getDocument(documentId);
      let updateData = { ...updates };

      // Handle tags: merge by default, overwrite if requested
      if (updates.tags) {
        if (options.overwrite) {
          updateData.tags = [...new Set(updates.tags)];
        } else {
          updateData.tags = [...new Set([...(currentDoc.tags || []), ...updates.tags])];
        }
      }

      // Handle correspondent: overwrite if requested or if not set
      if (updates.correspondent !== undefined) {
        if (!options.overwrite && currentDoc.correspondent && updates.correspondent) {
          // Legacy behavior: don't overwrite existing correspondent unless requested
          delete updateData.correspondent;
        }
      }

      if (updateData.custom_fields) {
        try {
          // Paperless-ngx PATCH for custom_fields is additive unless we clear first or send full set.
          await this.client.patch(`documents/${documentId}/`, { custom_fields: [] });
          
          let fieldsToProcess = [];
          if (Array.isArray(updateData.custom_fields)) {
            fieldsToProcess = updateData.custom_fields;
          } else if (typeof updateData.custom_fields === 'object' && updateData.custom_fields !== null) {
            fieldsToProcess = Object.entries(updateData.custom_fields).map(([name, value]) => ({ name, value }));
          }

          const normalized = [];
          for (const cf of fieldsToProcess) {
            if (cf.field) {
              normalized.push({ 
                field: cf.field, 
                value: normalizeCustomFieldValue(cf.value) 
              });
            } else if (cf.name) {
              const existing = await this.findExistingCustomField(cf.name);
              if (existing) {
                normalized.push({ 
                  field: existing.id, 
                  value: normalizeCustomFieldValue(cf.value) 
                });
              }
            }
          }
          updateData.custom_fields = normalized;
        } catch (err) { 
          logger.warn(`[PaperlessService] Custom field update failed for doc ${documentId}:`, err.message);
          delete updateData.custom_fields; 
        }
      }

      const apiPayload = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (!key.startsWith('_') && key !== 'document_id' && value !== null && value !== undefined) {
          apiPayload[key] = value;
        }
      }

      if (Object.keys(apiPayload).length === 0) return currentDoc;

      const headers = options.requestId ? { 'X-Request-Id': options.requestId } : {};
      logger.info(`[PaperlessService] PATCH doc ${documentId}`, { apiPayload });
      await this.client.patch(`documents/${documentId}/`, apiPayload, { headers });

      if (options.triggerFilenameReprocess !== false) {
        await this.reprocessDocuments([documentId]);
      }

      return await this.getDocument(documentId);
    } catch (error) { 
      if (error.response && error.response.data) {
        logger.error(`[PaperlessService] updateDocument detail: ${JSON.stringify(error.response.data)}`);
      }
      logger.error(`[PaperlessService] updateDocument failed for doc ${documentId}:`, error.message);
      return null; 
    }
  }

  async downloadOriginalDocument(documentId, retryCount = 0) {
    this.initialize();
    if (!this.client) return null;
    try {
      const response = await this.client.get(`documents/${documentId}/download/`, { responseType: 'arraybuffer' });
      if (!response?.data) return null;
      const buf = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
      const validation = this._validateBinaryResponse(buf, `document ${documentId}`);
      if (!validation.valid) {
        if (validation.reason === 'html_response' && retryCount === 0) {
          this.resetClient();
          return this.downloadOriginalDocument(documentId, retryCount + 1);
        }
        return null;
      }
      return buf;
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) this.resetClient();
      return null;
    }
  }

  async reprocessDocuments(documentIds) {
    this.initialize();
    if (!this.client) return false;
    const ids = Array.isArray(documentIds) ? documentIds : [documentIds];
    const filtered = ids.filter(id => Number.isInteger(Number(id)));
    if (filtered.length === 0) return false;
    try {
      await this.client.post('documents/bulk_edit/', { documents: filtered, method: 'reprocess' });
      return true;
    } catch (error) { return false; }
  }

  async getTagTextFromId(tagId) {
    this.initialize();
    await this.ensureTagCache();
    for (const tag of this.tagCache.values()) {
      if (tag.id === tagId) return tag.name;
    }
    try {
      const response = await this.client.get(`tags/${tagId}/`);
      if (response.data) {
        this.tagCache.set(response.data.name.toLowerCase(), response.data);
        return response.data.name;
      }
    } catch (e) {}
    return null;
  }

  async getCorrespondentNameById(correspondentId) {
    if (!correspondentId) return null;
    this.initialize();
    try {
      const response = await this.client.get(`correspondents/${correspondentId}/`);
      return response.data?.name || null;
    } catch (e) { return null; }
  }

  async getPermissionOfDocument(documentId) {
    this.initialize();
    try {
      const response = await this.client.get(`documents/${documentId}/`);
      return !!response.data; 
    } catch (e) { return false; }
  }

  async checkHealth() {
    this.initialize();
    if (!this.client) return { healthy: false, error: 'Client not initialized' };
    try {
      const response = await this.client.get('documents/?page_size=1');
      return { healthy: true, documentCount: response.data.count };
    } catch (error) { return { healthy: false, error: error.message }; }
  }

  async getOwnUserID() {
    this.initialize();
    try {
        const response = await this.client.get('users/', {
            params: {
                current_user: true,
                full_perms: true
            }
        });

        if (response.data.results && response.data.results.length > 0) {
            const userInfo = response.data.results;
            const user = userInfo.find(u => u.username === process.env.PAPERLESS_USERNAME);
            if (user) {
                return user.id;
            }
        }
        return null;
    } catch (error) {
        return null;
    }
  }

  async getTagNameById(tagId) {
    this.initialize();
    try {
      const response = await this.client.get(`tags/${tagId}/`);
      return response.data.name;
    } catch (error) {
      return null;
    }
  }

  async getTagCount() {
    this.initialize();
    try {
      const response = await this.client.get('tags/', { params: { count: true } });
      return response.data.count;
    } catch (error) { return 0; }
  }

  async getCorrespondentCount() {
    this.initialize();
    try {
      const response = await this.client.get('correspondents/', { params: { count: true } });
      return response.data.count;
    } catch (error) { return 0; }
  }

  async getDocumentCount() {
    this.initialize();
    try {
      const response = await this.client.get('documents/', { params: { count: true } });
      return response.data.count;
    } catch (error) { return 0; }
  }

  async listCorrespondentsNames() {
    this.initialize();
    let results = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      try {
        const response = await this.client.get('correspondents/', { params: { page, page_size: 100 } });
        if (!response.data.results) break;
        results = results.concat(response.data.results.map(c => ({ name: c.name, id: c.id, document_count: c.document_count })));
        hasMore = response.data.next !== null;
        page++;
      } catch (e) { break; }
    }
    return results;
  }

  async listTagNames() {
    this.initialize();
    let results = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      try {
        const response = await this.client.get('tags/', { params: { page, page_size: 100 } });
        if (!response.data.results) break;
        results = results.concat(response.data.results.map(t => ({ name: t.name, document_count: t.document_count })));
        hasMore = response.data.next !== null;
        page++;
      } catch (e) { break; }
    }
    return results;
  }

  async listDocumentTypesNames() {
    this.initialize();
    let results = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      try {
        const response = await this.client.get('document_types/', { params: { page, page_size: 100 } });
        if (!response.data.results) break;
        results = results.concat(response.data.results.map(dt => ({ name: dt.name, id: dt.id })));
        hasMore = response.data.next !== null;
        page++;
      } catch (e) { break; }
    }
    return results;
  }

  async getOrCreateCorrespondent(name, options = {}) {
    this.initialize();
    const restrict = options.restrictToExistingCorrespondents === true || process.env.RESTRICT_TO_EXISTING_CORRESPONDENTS === 'yes';
    try {
        const existing = await this.searchForExistingCorrespondent(name);
        if (existing) return existing;
        if (restrict) return null;
        const response = await this.client.post('correspondents/', { name });
        return response.data;
    } catch (error) { return null; }
  }

  async getFieldTaxonomy() {
    this.initialize();
    await this.ensureCustomFieldCache();
    const fields = Array.from(this.customFieldCache.values());
    return {
      fields: fields.map(f => ({
        id: f.id,
        name: f.name,
        data_type: f.data_type,
        extra_data: f.extra_data
      }))
    };
  }

  async fetchTesseractOCR(documentId) {
    this.initialize();
    try {
      // In Paperless-ngx, OCR content is typically in the 'content' field of the document
      const response = await this.client.get(`documents/${documentId}/`);
      return response.data.content || '';
    } catch (e) {
      return '';
    }
  }

  async initializeWithCredentials(apiUrl, token) {
    this.apiUrl = apiUrl || process.env.PAPERLESS_API_URL;
    this.apiToken = token || process.env.PAPERLESS_API_TOKEN;
    this.initialized = false;
    this.initialize();
    return this.validateConnection().then(res => res.success);
  }

  async createTag(tagData) {
    this.initialize();
    try {
      const response = await this.client.post('tags/', tagData);
      if (response.data) {
        this.tagCache.set(response.data.name.toLowerCase(), response.data);
        return response.data;
      }
    } catch (e) {
      throw new Error(`Failed to create tag: ${e.message}`);
    }
  }

  async bulkEdit(documentIds, updates) {
    this.initialize();
    try {
      const response = await this.client.post('documents/bulk_edit/', {
        documents: documentIds,
        method: 'set_tags', // Default method for tag updates in bulk
        parameters: updates
      });
      return response.status === 200;
    } catch (e) {
      return false;
    }
  }

  async getCorrespondentsFromDocument(documentId) {
    this.initialize();
    try {
      const response = await this.client.get(`documents/${documentId}/`);
      const correspondentId = response.data.correspondent;
      if (!correspondentId) return [];
      
      const corrResp = await this.client.get(`correspondents/${correspondentId}/`);
      return [corrResp.data];
    } catch (e) {
      return [];
    }
  }

  async getDocuments() {
    return this.getAllDocuments();
  }

  async searchForExistingCorrespondent(name) {
    this.initialize();
    try {
        const response = await this.client.get('correspondents/', { params: { name__icontains: name } });
        const results = response.data.results;
        return results.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
    } catch (error) { return null; }
  }

  async getOrCreateDocumentType(name) {
    this.initialize();
    try {
        const existing = await this.searchForExistingDocumentType(name);
        if (existing) return existing;
        const response = await this.client.post('document_types/', { name, matching_algorithm: 1, match: "", is_insensitive: true });
        return response.data;
    } catch (error) { return null; }
  }

  async searchForExistingDocumentType(name) {
    this.initialize();
    try {
        const response = await this.client.get('document_types/', { params: { name__icontains: name } });
        const results = response.data.results;
        return results.find(dt => dt.name.toLowerCase() === name.toLowerCase()) || null;
    } catch (error) { return null; }
  }
}

const instance = new PaperlessService();
module.exports = instance;
module.exports.normalizeCustomFieldValue = normalizeCustomFieldValue;
