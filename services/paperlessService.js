// services/paperlessService.js
const axios = require('axios');
const config = require('../config/config');
const fs = require('fs');
const path = require('path');
const { parse, isValid, parseISO, format } = require('date-fns');
const FieldMatcher = require('./FieldMatcher');
const logger = require('./logger');

class PaperlessService {
  constructor() {
    this.client = null;
    this.tagCache = new Map();
    this.customFieldCache = new Map();
    this.fieldMatcher = null;
    this.lastTagRefresh = 0;
    this.lastCustomFieldRefresh = 0;
    this.CACHE_LIFETIME = 3000; // 3 Sekunden
  }

  initialize() {
    if (!this.client) {
      let apiUrl = config.paperless.apiUrl;
      let apiToken = config.paperless.apiToken;

      // Fallback: read host data/.env directly if config lacks values
      if ((!apiUrl || !apiToken) && require('fs').existsSync(require('path').join(process.cwd(), 'data', '.env'))) {
        try {
          const envText = require('fs').readFileSync(require('path').join(process.cwd(), 'data', '.env'), 'utf8');
          const mUrl = envText.match(/PAPERLESS_API_URL=(.+)/);
          const mToken = envText.match(/PAPERLESS_API_TOKEN=(.+)/);
          if (mUrl && mUrl[1]) apiUrl = apiUrl || mUrl[1].trim();
          if (mToken && mToken[1]) apiToken = apiToken || mToken[1].trim();
        } catch (e) {
          // ignore
        }
      }

      if (apiUrl && apiToken) {
        this.client = axios.create({
          baseURL: apiUrl,
          headers: {
            'Authorization': `Token ${apiToken}`,
            'Content-Type': 'application/json'
          }
        });
      }
    }
  }

  async downloadDocument(documentId) {
    this.initialize();
    if (!this.client) {
      logger.warn('[PAPERLESS] Client not initialized for download');
      return null;
    }

    try {
      const response = await this.client.get(`/documents/${documentId}/download/`, {
        responseType: 'arraybuffer'
      });

      if (!response?.data) {
        logger.warn(`[PAPERLESS] Empty download for document ${documentId}`);
        return null;
      }

      return Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
    } catch (error) {
      console.error(`[PAPERLESS] Error downloading document ${documentId}:`, error.message);
      if (error.response) {
        console.log('[PAPERLESS] status:', error.response.status);
        console.log('[PAPERLESS] headers:', error.response.headers);
      }
      return null;
    }
  }

  async getThumbnailImage(documentId) {
    this.initialize();
    try { 
      const response = await this.client.get(`/documents/${documentId}/thumb/`, {
        responseType: 'arraybuffer'
      });

      if (response.data && response.data.byteLength > 0) {      
        return Buffer.from(response.data);
      }
      
      logger.warn(`No thumbnail data for document ${documentId}`);
      return null;
    } catch (error) {
      console.error(`[ERROR] fetching thumbnail for document ${documentId}:`, error.message);
      if (error.response) {
        console.log('[ERROR] status:', error.response.status);
        console.log('[ERROR] headers:', error.response.headers);
      }
      return null; // Behalten Sie das return null bei, damit der Prozess weiterlaufen kann
    }
  }


  /**
   * Get rendered page images for a document
   * @param {number} documentId - Document ID
   * @returns {Promise<Array<Buffer>>} Array of page image buffers
   */
  async getDocumentPageImages(documentId) {
    this.initialize();
    const pageImages = [];

    try {
      const docMeta = await this.getDocument(documentId);
      const pageCount = docMeta?.page_count || docMeta?.pageCount || 1;
      const maxPages = config.duplicateDetection?.maxPagesToCompare || 10;
      const pagesToFetch = Math.min(pageCount, maxPages);

      for (let page = 1; page <= pagesToFetch; page++) {
        try {
          const response = await this.client.get(`/documents/${documentId}/preview/`, {
            params: { page },
            responseType: 'arraybuffer',
            timeout: 30000
          });
          pageImages.push(Buffer.from(response.data));
        } catch (pageError) {
          console.warn(`[PAPERLESS] Could not fetch page ${page} for document ${documentId}`);
        }
      }

      return pageImages;
    } catch (error) {
      console.error(`[PAPERLESS] Error fetching page images for document ${documentId}:`, error.message);
      return [];
    }
  }

  /**
   * Add a tag to a document by name
   * @param {number} documentId - Document ID
   * @param {string} tagName - Tag name
   * @returns {Promise<boolean>} Whether the tag was added
   */
  async addTagToDocument(documentId, tagName) {
    try {
      const { tagIds, errors } = await this.processTags([tagName]);
      if (errors?.length) {
        console.warn(`[PAPERLESS] Tag processing errors for ${documentId}:`, errors);
      }
      if (!tagIds || tagIds.length === 0) {
        return false;
      }
      await this.updateDocument(documentId, { tags: tagIds });
      return true;
    } catch (error) {
      console.error(`[PAPERLESS] Error adding tag to document ${documentId}:`, error.message);
      return false;
    }
  }

  /**
   * Resolve a tag ID by name without creating new tags.
   * @param {string} tagName - Tag name
   * @returns {Promise<number|null>} Tag ID or null if not found
   */
  async getTagIdByName(tagName) {
    this.initialize();
    if (!tagName) return null;
    try {
      await this.ensureTagCache();
      const tag = await this.findExistingTag(tagName);
      return tag?.id || null;
    } catch (error) {
      console.error(`[PAPERLESS] Error resolving tag "${tagName}":`, error.message);
      return null;
    }
  }

  /**
   * Remove a tag from a document by tag ID.
   * @param {number} documentId - Document ID
   * @param {number} tagId - Tag ID to remove
   * @returns {Promise<boolean>} Whether the update succeeded
   */
  async removeTagFromDocument(documentId, tagId) {
    this.initialize();
    if (!this.client) return false;
    try {
      const currentDoc = await this.getDocument(documentId);
      if (!currentDoc?.tags) return false;

      const remainingTags = currentDoc.tags.filter(id => id !== tagId);
      await this.client.patch(`/documents/${documentId}/`, { tags: remainingTags });
      return true;
    } catch (error) {
      console.error(`[PAPERLESS] Error removing tag ${tagId} from document ${documentId}:`, error.message);
      return false;
    }
  }

  /**
   * Set storage path for a document.
   * @param {number} documentId - Document ID
   * @param {number} storagePathId - Storage path ID
   * @returns {Promise<boolean>} Whether the update succeeded
   */
  async setStoragePath(documentId, storagePathId) {
    this.initialize();
    if (!this.client) return false;
    try {
      await this.client.patch(`/documents/${documentId}/`, { storage_path: storagePathId });
      return true;
    } catch (error) {
      console.error(`[PAPERLESS] Error setting storage path for document ${documentId}:`, error.message);
      return false;
    }
  }

  /**
   * Merge documents using Paperless bulk_edit.
   * @param {number[]} documentIds - Documents to merge
   * @param {number} metadataDocumentId - Document ID whose metadata to keep
   * @param {boolean} deleteOriginals - Whether to delete originals
   * @returns {Promise<boolean>} Whether the merge request succeeded
   */
  async mergeDocuments(documentIds, metadataDocumentId, deleteOriginals = true) {
    this.initialize();
    if (!this.client) return false;
    try {
      const payload = {
        documents: documentIds,
        method: 'merge',
        parameters: {
          metadata_document_id: metadataDocumentId,
          delete_originals: !!deleteOriginals
        }
      };
      await this.client.post('/documents/bulk_edit/', payload);
      return true;
    } catch (error) {
      console.error('[PAPERLESS] Error merging documents:', error.message);
      return false;
    }
  }

  /**
   * Rotate documents using Paperless bulk_edit.
   * @param {number[]|number} documentIds - Documents to rotate
   * @param {number} degrees - Rotation degrees (90, 180, 270)
   * @returns {Promise<boolean>} Whether the rotate request succeeded
   */
  async rotateDocuments(documentIds, degrees) {
    this.initialize();
    if (!this.client) return false;
    const ids = Array.isArray(documentIds) ? documentIds : [documentIds];
    const filtered = ids.map(id => Number(id)).filter(id => Number.isInteger(id));
    if (filtered.length === 0) return false;
    const rotation = Number.parseInt(degrees, 10);
    if (![0, 90, 180, 270].includes(rotation)) {
      console.warn('[PAPERLESS] Invalid rotation degrees:', degrees);
      return false;
    }
    if (rotation === 0) {
      return true;
    }
    try {
      await this.client.post('/documents/bulk_edit/', {
        documents: filtered,
        method: 'rotate',
        parameters: { degrees: rotation }
      });
      return true;
    } catch (error) {
      console.error('[PAPERLESS] Error rotating documents:', error.message);
      return false;
    }
  }

  /**
   * Add a note to a document
   * @param {number} documentId - Document ID
   * @param {string} note - Note content
   */
  async addNoteToDocument(documentId, note) {
    this.initialize();
    try {
      await this.client.post(`/documents/${documentId}/notes/`, { note });
    } catch (error) {
      console.error(`[PAPERLESS] Error adding note to document ${documentId}:`, error.message);
    }
  }

  // Aktualisiert den Tag-Cache, wenn er älter als CACHE_LIFETIME ist
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

  // Lädt alle existierenden Tags
  async refreshTagCache() {
      try {
        logger.debug('Refreshing tag cache...');
        this.tagCache.clear();
        let nextUrl = '/tags/';
        while (nextUrl) {
          const response = await this.client.get(nextUrl);

          // Validate response structure
          if (!response?.data?.results) {
            console.error('[ERROR] Invalid response structure from API:', response?.data);
            break;
          }

          response.data.results.forEach(tag => {
            this.tagCache.set(tag.name.toLowerCase(), tag);
          });

          // Fix: Extract only path and query from next URL to prevent HTTP downgrade
          if (response.data.next) {
            try {
              const nextUrlObj = new URL(response.data.next);
              const baseUrlObj = new URL(this.client.defaults.baseURL);

              // Extract path relative to baseURL to avoid double /api/ prefix
              let relativePath = nextUrlObj.pathname;
              if (baseUrlObj.pathname && baseUrlObj.pathname !== '/') {
                // Remove the base path if it's included in the next URL path
                relativePath = relativePath.replace(baseUrlObj.pathname, '');
              }
              // Ensure path starts with /
              if (!relativePath.startsWith('/')) {
                relativePath = '/' + relativePath;
              }

              nextUrl = relativePath + nextUrlObj.search;
              logger.debug(`Next page URL: ${nextUrl}`);
            } catch (e) {
              console.error('[ERROR] Failed to parse next URL:', e.message);
              nextUrl = null;
            }
          } else {
            nextUrl = null;
          }
        }
        this.lastTagRefresh = Date.now();
        logger.debug(`Tag cache refreshed. Found ${this.tagCache.size} tags.`);
      } catch (error) {
        console.error('[ERROR] refreshing tag cache:', error.message);
        throw error;
      }
    }

  async initializeWithCredentials(apiUrl, apiToken) {
    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Test the connection
    try {
      await this.client.get('/');
      return true;
    } catch (error) {
      console.error('[ERROR] Failed to initialize with credentials:', error.message);
      this.client = null;
      return false;
    }
  }

  async createCustomFieldSafely(fieldName, fieldType, default_currency) {
    this.initialize();
    const maxRetries = (config.ocrCheckpoint && config.ocrCheckpoint.maxRetries) || 3;
    const baseDelay = (config.ocrCheckpoint && config.ocrCheckpoint.retryDelay) || 1000;
    const maxDelay = 5000;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const extractErrorInfo = (err) => {
      const status = err.response?.status;
      const data = err.response?.data;
      const message = err.message || (data && JSON.stringify(data)) || 'unknown error';
      const code = err.code || null;
      return { statusCode: status, message, data, code };
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.debug({ event: 'ocr_custom_field_creation_attempt', field: fieldName, attempt });
        const response = await this.client.post('/custom_fields/', { 
          name: fieldName,
          data_type: fieldType,
          extra_data: {
            default_currency: default_currency || null
          }
        });
        const newField = response.data;
        logger.info({ event: 'ocr_custom_field_creation_success', field: fieldName, fieldId: newField.id });
        this.customFieldCache.set(fieldName.toLowerCase(), newField);
        this._refreshFieldMatcher();
        return newField;
      } catch (error) {
        const info = extractErrorInfo(error);

        // Categorize
        const status = info.statusCode;
        const code = info.code;
        const lowerMsg = String(info.message || '').toLowerCase();

        // Already exists (non-retryable) - try to refresh cache and find existing
        if (status === 400 && lowerMsg.includes('already') && lowerMsg.includes('exist')) {
          try {
            await this.refreshCustomFieldCache();
            const existingField = await this.findExistingCustomField(fieldName);
            if (existingField) {
              logger.info({ event: 'ocr_custom_field_found_existing', field: fieldName, fieldId: existingField.id });
              return existingField;
            }
          } catch (inner) {
            logger.warn({ event: 'ocr_custom_field_find_existing_failed', field: fieldName, error: inner.message });
          }
          return { success: false, error: { type: 'already_exists', message: info.message, statusCode: status, retryable: false } };
        }

        // Validation errors (400 but not already exists)
        if (status === 400) {
          logger.error({ event: 'ocr_custom_field_validation_error', field: fieldName, error: info });
          return { success: false, error: { type: 'validation', message: info.message, statusCode: status, retryable: false } };
        }

        // Unauthorized / Forbidden
        if (status === 401 || status === 403) {
          logger.error({ event: 'ocr_custom_field_permission_error', field: fieldName, error: info });
          return { success: false, error: { type: 'permission', message: info.message, statusCode: status, retryable: false } };
        }

        // Rate limit
        if (status === 429) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          logger.warn({ event: 'ocr_custom_field_rate_limited', field: fieldName, attempt, delay });
          if (attempt < maxRetries) {
            await sleep(delay);
            logger.debug({ event: 'ocr_custom_field_retry', field: fieldName, attempt, delay });
            continue;
          }
          return { success: false, error: { type: 'rate_limit', message: info.message, statusCode: status, retryable: true } };
        }

        // Server errors - retryable
        if ([500, 502, 503, 504].includes(status) || ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET'].includes(code)) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          logger.warn({ event: 'ocr_custom_field_transient_error', field: fieldName, status, code, attempt, delay });
          if (attempt < maxRetries) {
            await sleep(delay);
            logger.debug({ event: 'ocr_custom_field_retry', field: fieldName, attempt, delay });
            continue;
          }
          return { success: false, error: { type: 'transient', message: info.message, statusCode: status, retryable: true } };
        }

        // Network error with no response - treat as retryable
        if (!error.response && code) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          logger.warn({ event: 'ocr_custom_field_network_error', field: fieldName, code, attempt, delay });
          if (attempt < maxRetries) {
            await sleep(delay);
            logger.debug({ event: 'ocr_custom_field_retry', field: fieldName, attempt, delay });
            continue;
          }
          return { success: false, error: { type: 'network', message: info.message, statusCode: null, retryable: true } };
        }

        // Unknown - fail non-retryable by default
        logger.error({ event: 'ocr_custom_field_unknown_error', field: fieldName, info });
        return { success: false, error: { type: 'unknown', message: info.message, statusCode: status || null, retryable: false } };
      }
    }
    // Should not reach here, but return a generic failure
    return { success: false, error: { type: 'unknown', message: 'Exceeded retries', statusCode: null, retryable: true } };
  }

  async getExistingCustomFields(documentId) {
    try {
      const response = await this.client.get(`/documents/${documentId}/`);
      logger.debug(`Document response custom fields: ${JSON.stringify(response.data.custom_fields)}`);
      return response.data.custom_fields || [];
    } catch (error) {
      console.error(`[ERROR] fetching document ${documentId}:`, error.message);
      return [];
    }
  }
  
  async findExistingCustomField(fieldName) {
    const normalizedName = fieldName.toLowerCase();

    await this.ensureCustomFieldCache();
    
    const cachedField = this.customFieldCache.get(normalizedName);
    if (cachedField) {
      logger.debug(`Found custom field "${fieldName}" in cache with ID ${cachedField.id}`);
      return cachedField;
    }

    if (this.fieldMatcher) {
      const match = await this.fieldMatcher.findBestMatch(fieldName);
      if (match?.field) {
        const matchName = match.field.name || fieldName;
        const confidence = typeof match.confidence === 'number'
          ? match.confidence.toFixed(2)
          : 'n/a';
        console.log(`[DEBUG] Matched custom field "${fieldName}" -> "${matchName}" (${match.method}, ${confidence})`);
        this.customFieldCache.set(matchName.toLowerCase(), match.field);
        return match.field;
      }
    }

    return null;
  }

  async refreshCustomFieldCache() {
      try {
        logger.debug('Refreshing custom field cache...');
        this.customFieldCache.clear();
        let nextUrl = '/custom_fields/';
        while (nextUrl) {
          const response = await this.client.get(nextUrl);

          // Validate response structure
          if (!response?.data?.results) {
            console.error('[ERROR] Invalid response structure from API:', response?.data);
            break;
          }

          response.data.results.forEach(field => {
            this.customFieldCache.set(field.name.toLowerCase(), field);
          });

          // Fix: Extract only path and query from next URL to prevent HTTP downgrade
          if (response.data.next) {
            try {
              const nextUrlObj = new URL(response.data.next);
              const baseUrlObj = new URL(this.client.defaults.baseURL);

              // Extract path relative to baseURL to avoid double /api/ prefix
              let relativePath = nextUrlObj.pathname;
              if (baseUrlObj.pathname && baseUrlObj.pathname !== '/') {
                // Remove the base path if it's included in the next URL path
                relativePath = relativePath.replace(baseUrlObj.pathname, '');
              }
              // Ensure path starts with /
              if (!relativePath.startsWith('/')) {
                relativePath = '/' + relativePath;
              }

              nextUrl = relativePath + nextUrlObj.search;
              logger.debug(`Next page URL: ${nextUrl}`);
            } catch (e) {
              console.error('[ERROR] Failed to parse next URL:', e.message);
              nextUrl = null;
            }
          } else {
            nextUrl = null;
          }
        }
        this._refreshFieldMatcher();
        this.lastCustomFieldRefresh = Date.now();
        logger.debug(`Custom field cache refreshed. Found ${this.customFieldCache.size} fields.`);
      } catch (error) {
        console.error('[ERROR] refreshing custom field cache:', error.message);
        throw error;
      }
    }


  async findExistingTag(tagName) {
    const normalizedName = tagName.toLowerCase();
    
    // 1. Zuerst im Cache suchen
    const cachedTag = this.tagCache.get(normalizedName);
    if (cachedTag) {
      logger.debug(`Found tag "${tagName}" in cache with ID ${cachedTag.id}`);
      return cachedTag;
    }

    // 2. Direkte API-Suche
    try {
      const response = await this.client.get('/tags/', {
        params: {
          name__iexact: normalizedName  // Case-insensitive exact match
        }
      });

      if (response.data.results.length > 0) {
        const foundTag = response.data.results[0];
        logger.debug(`Found existing tag "${tagName}" via API with ID ${foundTag.id}`);
        this.tagCache.set(normalizedName, foundTag);
        return foundTag;
      }
    } catch (error) {
      console.warn(`[ERROR] searching for tag "${tagName}":`, error.message);
    }

    return null;
  }

  async createTagSafely(tagName) {
    const normalizedName = tagName.toLowerCase();
    
    try {
      // Versuche zuerst, den Tag zu erstellen
      const response = await this.client.post('/tags/', { name: tagName });
      const newTag = response.data;
      logger.debug(`Successfully created tag "${tagName}" with ID ${newTag.id}`);
      this.tagCache.set(normalizedName, newTag);
      return newTag;
    } catch (error) {
      if (error.response?.status === 400) {
        // Bei einem 400er Fehler könnte der Tag bereits existieren
        // Aktualisiere den Cache und suche erneut
        await this.refreshTagCache();
        
        // Suche nochmal nach dem Tag
        const existingTag = await this.findExistingTag(tagName);
        if (existingTag) {
          return existingTag;
        }
      }
      throw error; // Wenn wir den Tag nicht finden konnten, werfen wir den Fehler weiter
    }
  }

  async processTags(tagNames, options = {}) {
    try {
      this.initialize();
      await this.ensureTagCache();
      
      // Check if we should restrict to existing tags
      // Explicitly check options first, then env var
      const restrictToExistingTags = options.restrictToExistingTags === true || 
                                   (options.restrictToExistingTags === undefined && 
                                    process.env.RESTRICT_TO_EXISTING_TAGS === 'yes');
      
      // Input validation
      if (!tagNames) {
        console.warn('[DEBUG] No tags provided to processTags');
        return { tagIds: [], errors: [] };
      }

      // Convert to array if string is passed
      const tagsArray = typeof tagNames === 'string' 
        ? [tagNames]
        : Array.isArray(tagNames) 
          ? tagNames 
          : [];

      if (tagsArray.length === 0) {
        console.warn('[DEBUG] No valid tags to process');
        return { tagIds: [], errors: [] };
      }
  
      const tagIds = [];
      const errors = [];
      const processedTags = new Set(); // Prevent duplicates
      
      console.log(`[DEBUG] Processing tags with restrictToExistingTags=${restrictToExistingTags}`);
  
      // Process regular tags
      for (const tagName of tagsArray) {
        if (!tagName || typeof tagName !== 'string') {
          console.warn(`[DEBUG] Skipping invalid tag name: ${tagName}`);
          errors.push({ tagName, error: 'Invalid tag name' });
          continue;
        }
  
        const normalizedName = tagName.toLowerCase().trim();
        
        // Skip empty or already processed tags
        if (!normalizedName || processedTags.has(normalizedName)) {
          continue;
        }
  
        try {
          // Search for existing tag first
          let tag = await this.findExistingTag(tagName);
          
          // If no existing tag found and restrictions are not enabled, create new one
          if (!tag && !restrictToExistingTags) {
            tag = await this.createTagSafely(tagName);
          } else if (!tag && restrictToExistingTags) {
            console.log(`[DEBUG] Tag "${tagName}" does not exist and restrictions are enabled, skipping`);
            errors.push({ tagName, error: 'Tag does not exist and restrictions are enabled' });
            continue;
          }
  
          if (tag && tag.id) {
            tagIds.push(tag.id);
            processedTags.add(normalizedName);
          }
  
        } catch (error) {
          console.error(`[ERROR] processing tag "${tagName}":`, error.message);
          errors.push({ tagName, error: error.message });
        }
      }
  
      // Add AI-Processed tag if enabled
      if (process.env.ADD_AI_PROCESSED_TAG === 'yes' && process.env.AI_PROCESSED_TAG_NAME) {
        try {
          const aiTagName = process.env.AI_PROCESSED_TAG_NAME;
          let aiTag = await this.findExistingTag(aiTagName);
          
          if (!aiTag) {
            aiTag = await this.createTagSafely(aiTagName);
          }
  
          if (aiTag && aiTag.id) {
            tagIds.push(aiTag.id);
          }
        } catch (error) {
          console.error(`[ERROR] processing AI tag "${process.env.AI_PROCESSED_TAG_NAME}":`, error.message);
          errors.push({ tagName: process.env.AI_PROCESSED_TAG_NAME, error: error.message });
        }
      }
  
      return { 
        tagIds: [...new Set(tagIds)], // Remove any duplicates
        errors 
      };      
    } catch (error) {
      console.error('[ERROR] in processTags:', error);
      throw new Error(`[ERROR] Failed to process tags: ${error.message}`);
    }
  }

  async getTags() {
    this.initialize();
    if (!this.client) {
      console.error('[DEBUG] Client not initialized');
      return [];
    }

    let tags = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const params = {
          page,
          page_size: 100,  // Maximale Seitengröße für effizientes Laden
          ordering: 'name'  // Optional: Sortierung nach Namen
        };

        const response = await this.client.get('/tags/', { params });
        
        if (!response?.data?.results || !Array.isArray(response.data.results)) {
          console.error(`[DEBUG] Invalid API response on page ${page}`);
          break;
        }

        tags = tags.concat(response.data.results);
        hasMore = response.data.next !== null;
        page++;

        console.log(
          `[DEBUG] Fetched page ${page-1}, got ${response.data.results.length} tags. ` +
          `[DEBUG] Total so far: ${tags.length}`
        );

        // Kleine Verzögerung um die API nicht zu überlasten
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[ERRRO] fetching tags page ${page}:`, error.message);
        if (error.response) {
          console.error('[DEBUG] Response status:', error.response.status);
          console.error('[DEBUG] Response data:', error.response.data);
        }
        break;
      }
    }

    return tags;
  }

  async getTagCount() {
    this.initialize();
    try {
      const response = await this.client.get('/tags/', {
        params: { count: true }
      });
      return response.data.count;
    } catch (error) {
      console.error('[ERROR] fetching tag count:', error.message);
      return 0;
    }
  }

  async getCorrespondentCount() {
    this.initialize();
    try {
      const response = await this.client.get('/correspondents/', {
        params: { count: true }
      });
      return response.data.count;
    } catch (error) {
      console.error('[ERROR] fetching correspondent count:', error.message);
      return 0;
    }
  }

  async getDocumentCount() {
    this.initialize();
    try {
      const response = await this.client.get('/documents/', {
        params: { count: true }
      });
      return response.data.count;
    } catch (error) {
      console.error('[ERROR] fetching document count:', error.message);
      return 0;
    }
  }

  async listCorrespondentsNames() {
    this.initialize();
    let allCorrespondents = [];
    let page = 1;
    let hasNextPage = true;
  
    try {
      while (hasNextPage) {
        const response = await this.client.get('/correspondents/', {
          params: {
            fields: 'id,name',
            count: true,
            page: page
          }
        });
  
        const { results, next } = response.data;
        
        // Füge die Ergebnisse der aktuellen Seite hinzu
        allCorrespondents = allCorrespondents.concat(
          results.map(correspondent => ({
            name: correspondent.name,
            id: correspondent.id,
            document_count: correspondent.document_count
          }))
        );
  
        // Prüfe, ob es eine nächste Seite gibt
        hasNextPage = next !== null;
        page++;
  
        // Optional: Füge eine kleine Verzögerung hinzu, um die API nicht zu überlasten
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
  
      return allCorrespondents;
  
    } catch (error) {
      console.error('[ERROR] fetching correspondent names:', error.message);
      return [];
    }
  }

  async listDocumentTypesNames() {
    this.initialize();
    let allDocumentTypes = [];
    let page = 1;
    let hasNextPage = true;
  
    try {
      while (hasNextPage) {
        const response = await this.client.get('/document_types/', {
          params: {
            fields: 'id,name',
            count: true,
            page: page
          }
        });
  
        const { results, next } = response.data;
        
        allDocumentTypes = allDocumentTypes.concat(
          results.map(docType => ({
            name: docType.name,
            id: docType.id
          }))
        );
  
        hasNextPage = next !== null;
        page++;
  
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
  
      return allDocumentTypes;
  
    } catch (error) {
      console.error('[ERROR] fetching document type names:', error.message);
      return [];
    }
  }

  async listTagNames() {
    this.initialize();
    let allTags = [];
    let currentPage = 1;
    let hasMorePages = true;
  
    try {
      while (hasMorePages) {
        const response = await this.client.get('/tags/', {
          params: {
            fields: 'name',
            count: true,
            page: currentPage,
            page_size: 100 // Sie können die Seitengröße nach Bedarf anpassen
          }
        });
  
        // Füge die Tags dieser Seite zum Gesamtergebnis hinzu
        allTags = allTags.concat(
          response.data.results.map(tag => ({
            name: tag.name,
            document_count: tag.document_count
          }))
        );
  
        // Prüfe, ob es weitere Seiten gibt
        hasMorePages = response.data.next !== null;
        currentPage++;
      }
  
      return allTags;
    } catch (error) {
      console.error('[DEBUG] Error fetching tag names:', error.message);
      return [];
    }
  }
  
  async getAllDocuments() {
    this.initialize();
    if (!this.client) {
      console.error('[DEBUG] Client not initialized');
      return [];
    }

    let documents = [];
    let page = 1;
    let hasMore = true;
    const shouldFilterByTags = process.env.PROCESS_PREDEFINED_DOCUMENTS === 'yes';
    let tagIds = [];

    // Vorverarbeitung der Tags, wenn Filter aktiv ist
    if (shouldFilterByTags) {
      if (!process.env.TAGS) {
        console.warn('[DEBUG] PROCESS_PREDEFINED_DOCUMENTS is set to yes but no TAGS are defined');
        return [];
      }
      
      // Hole die Tag-IDs für die definierten Tags
      const tagNames = process.env.TAGS.split(',').map(tag => tag.trim());
      await this.ensureTagCache();
      
      for (const tagName of tagNames) {
        const tag = await this.findExistingTag(tagName);
        if (tag) {
          tagIds.push(tag.id);
        }
      }
      
      if (tagIds.length === 0) {
        logger.warn('None of the specified tags were found');
        return [];
      }
      
      logger.debug('Filtering documents for tag IDs: %o', tagIds);
    }

    while (hasMore) {
      try {
        const params = {
          page,
          page_size: 100,
          fields: 'id,title,created,created_date,added,tags,correspondent'
        };

        // Füge Tag-Filter hinzu, wenn Tags definiert sind
        if (shouldFilterByTags && tagIds.length > 0) {
          // Füge jeden Tag-ID als separaten Parameter hinzu
          tagIds.forEach(id => {
            // Verwende tags__id__in für multiple Tag-Filterung
            params.tags__id__in = tagIds.join(',');
          });
        }

        const response = await this.client.get('/documents/', { params });
        
        if (!response?.data?.results || !Array.isArray(response.data.results)) {
          logger.error(`Invalid API response on page ${page}`);
          break;
        }

        documents = documents.concat(response.data.results);
        hasMore = response.data.next !== null;
        page++;

        logger.debug(`Fetched page ${page-1}, got ${response.data.results.length} documents. Total so far: ${documents.length}`);

        // Kleine Verzögerung um die API nicht zu überlasten
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        logger.error(`Error fetching documents page ${page}: ${error.message}`);
        if (error.response) {
          logger.error('Response status: %s', error.response.status);
        }
        break;
      }
    }

    logger.debug(`Finished fetching. Found ${documents.length} documents.`);
    return documents;
  }

  /**
   * Get all documents WITHOUT tag filtering.
   * Used for UI dropdowns where users should see all available documents.
   *
   * @returns {Promise<Array>} Array of all documents
   */
  async getAllDocumentsUnfiltered() {
    this.initialize();
    if (!this.client) {
      console.error('[DEBUG] Client not initialized');
      return [];
    }

    let documents = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const params = {
          page,
          page_size: 100,
          fields: 'id,title,created,created_date,added,tags,correspondent'
        };

        const response = await this.client.get('/documents/', { params });

        if (!response?.data?.results || !Array.isArray(response.data.results)) {
          logger.error(`Invalid API response on page ${page}`);
          break;
        }

        documents = documents.concat(response.data.results);
        hasMore = response.data.next !== null;
        page++;

        // Small delay to avoid overloading the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        logger.error(`Error fetching documents page ${page}: ${error.message}`);
        if (error.response) {
          logger.error('Response status: %s', error.response.status);
        }
        break;
      }
    }

    logger.debug(`Fetched all documents unfiltered. Found ${documents.length} documents.`);
    return documents;
  }

  async getAllDocumentIds() {
    /**
     * Get all Document IDs from the Paperless API.
     * 
     * @returns    An array of all Document IDs.
     * @throws     An error if the request fails.
     * @note       This method is used to get all Document IDs for further processing.
     */
    this.initialize();
    try {
      const response = await this.client.get('/documents/', {
        params: { 
          page,
          page_size: 100,
          fields: 'id',
        }
      });
      return response.data.results.map(doc => doc.id);
    } catch (error) {
      console.error('[ERROR] fetching document IDs:', error.message);
      return [];
    }
  }

  async getAllDocumentIdsScan() {
    /**
     * Get all Document IDs from the Paperless API.
     * 
     * @returns    An array of all Document IDs.
     * @throws     An error if the request fails.
     * @note       This method is used to get all Document IDs for further processing.
     */
    this.initialize();
    if (!this.client) {
      console.error('[DEBUG] Client not initialized');
      return [];
    }

    let documents = [];
    let page = 1;
    let hasMore = true;
    const shouldFilterByTags = process.env.PROCESS_PREDEFINED_DOCUMENTS === 'yes';
    let tagIds = [];

    // Vorverarbeitung der Tags, wenn Filter aktiv ist
    if (shouldFilterByTags) {
      if (!process.env.TAGS) {
        console.warn('[DEBUG] PROCESS_PREDEFINED_DOCUMENTS is set to yes but no TAGS are defined');
        return [];
      }
      
      // Hole die Tag-IDs für die definierten Tags
      const tagNames = process.env.TAGS.split(',').map(tag => tag.trim());
      await this.ensureTagCache();
      
      for (const tagName of tagNames) {
        const tag = await this.findExistingTag(tagName);
        if (tag) {
          tagIds.push(tag.id);
        }
      }
      
      if (tagIds.length === 0) {
        logger.warn('None of the specified tags were found');
        return [];
      }
      
      logger.debug('Filtering documents for tag IDs: %o', tagIds);
    }

    while (hasMore) {
      try {
        const params = {
          page,
          page_size: 100,
          fields: 'id'
        };

        const response = await this.client.get('/documents/', { params });
        
        if (!response?.data?.results || !Array.isArray(response.data.results)) {
          logger.error(`Invalid API response on page ${page}`);
          break;
        }

        documents = documents.concat(response.data.results);
        hasMore = response.data.next !== null;
        page++;

        logger.debug(`Fetched page ${page-1}, got ${response.data.results.length} documents. Total so far: ${documents.length}`);

        // Kleine Verzögerung um die API nicht zu überlasten
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[ERROR] fetching documents page ${page}:`, error.message);
        if (error.response) {
          console.error('[DEBUG] Response status:', error.response.status);
        }
        break;
      }
    }

    console.log(`[DEBUG] Finished fetching. Found ${documents.length} documents.`);
    return documents;
  }

  async getCorrespondentNameById(correspondentId) {
    /**
     * Get the Name of a Correspondent by its ID.
     * 
     * @param   id  The id of the correspondent.
     * @returns    The name of the correspondent.
     */
    this.initialize();
    try {
      const response = await this.client.get(`/correspondents/${correspondentId}/`);
      return response.data;
    } catch (error) {
      console.error(`[ERROR] fetching correspondent ${correspondentId}:`, error.message);
      return null;
    }
  }
  
  async getTagNameById(tagId) {
    /**
     * Get the Name of a Tag by its ID.
     *
     * @param   id  The id of the tag.
     * @returns    The name of the tag.
     */
    this.initialize();
    try {
      const response = await this.client.get(`/tags/${tagId}/`);
      return response.data.name;
    } catch (error) {
      console.error(`[ERROR] fetching tag name for ID ${tagId}:`, error.message);
      return null;
    }
  }

  async getDocumentsWithTitleTagsCorrespondentCreated () {
    /**
     * Get all documents with metadata (title, tags, correspondent, created date).
     * 
     * @returns    An array of documents with metadata.
     * @throws     An error if the request fails.
     * @note       This method is used to get all documents with metadata for further processing 
     */
    
    this.initialize();
    try {
      const response = await this.client.get('/documents/', {
        params: {
          fields: 'id,title,tags,correspondent,created'
        }
      });
      return response.data.results;
    } catch (error) {
      console.error('[ERROR] fetching documents with metadata:', error.message);
      return [];
    }
  }

  async getDocumentsForRAGService () {
    /**
     * Get all documents with metadata (title, tags, correspondent, created date and content).
     * 
     * @returns    An array of documents with metadata.
     * @throws     An error if the request fails.
     * @note       This method is used to get all documents with metadata for further processing 
     */
    
    this.initialize();
    try {
      let response;
      let page = 1;
      let hasMore = true;
  
      while (hasMore) {
        try {
          const params = {
            params: { fields: 'id,title,tags,correspondent,created,content' },
            page,
            page_size: 100,  // Maximale Seitengröße für effizientes Laden
            ordering: 'name'  // Optional: Sortierung nach Namen
          };

          response = await this.client.get('/documents/', { params });

          if (!response?.data?.results || !Array.isArray(response.data.results)) {
            console.error(`[DEBUG] Invalid API response on page ${page}`);
            break;
          }

          hasMore = response.data.next !== null;
          page++;
        
        } catch (error) {
          console.error(`[ERROR] fetching documents page ${page}:`, error.message);
          if (error.response) {
            console.error('[ERROR] Response status:', error.response.status);
          }
          break;
        }
      }  
      return response.data.results;
    } catch (error) {
      console.error('[ERROR] fetching documents with metadata:', error.message);
      return [];
    }
  }


  // Aktualisierte getDocuments Methode
  async getDocuments() {
    return this.getAllDocuments();
  }

  async getDocumentContent(documentId) {
    this.initialize();
    const response = await this.client.get(`/documents/${documentId}/`);
    return response.data.content;
  }

  async getDocument(documentId) {
    this.initialize();
    try {
      const response = await this.client.get(`/documents/${documentId}/`);
      return response.data;
    } catch (error) {
      console.error(`[ERROR] fetching document ${documentId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get lightweight document metadata useful for other services
   * @param {number} documentId
   * @returns {Promise<Object|null>} {id,title,tags,original_file_name,content,page_count}
   */
  async getDocumentMetadata(documentId) {
    try {
      const doc = await this.getDocument(documentId);
      if (!doc) return null;
      return {
        id: doc.id,
        title: doc.title || (doc.metadata && doc.metadata.title) || '',
        tags: doc.tags || [],
        original_file_name: doc.original_file_name || '',
        content: doc.content || '',
        page_count: doc.page_count || doc.pageCount || 1
      };
    } catch (err) {
      console.warn(`[PAPERLESS] getDocumentMetadata failed for ${documentId}:`, err && err.message ? err.message : err);
      return null;
    }
  }

  /**
   * Get correspondents associated with a document
   * @param {number} documentId
   * @returns {Promise<Array>} Array of correspondents (objects or strings)
   */
  async getCorrespondentsFromDocument(documentId) {
    try {
      const doc = await this.getDocument(documentId);
      if (!doc) return [];
      if (Array.isArray(doc.correspondents) && doc.correspondents.length > 0) return doc.correspondents;
      if (doc.correspondent) return [doc.correspondent];
      // Paperless older versions may store correspondents in metadata
      if (doc.metadata && doc.metadata.correspondent) return [doc.metadata.correspondent];
      return [];
    } catch (err) {
      console.warn(`[PAPERLESS] getCorrespondentsFromDocument failed for ${documentId}:`, err && err.message ? err.message : err);
      return [];
    }
  }

  async searchForCorrespondentById(id) {
    try {
      const response = await this.client.get('/correspondents/', {
          params: {
              id: id
          }
      });

      const results = response.data.results;
      
      if (results.length === 0) {
          console.log(`[DEBUG] No correspondent with "${id}" found`);
          return null;
      }
      
      if (results.length > 1) {
          console.log(`[DEBUG] Multiple correspondents found:`);
          results.forEach(c => {
              console.log(`- ID: ${c.id}, Name: ${c.name}`);
          });
          return results;
      }

      // Genau ein Ergebnis gefunden
      return {
          id: results[0].id,
          name: results[0].name
      };

  } catch (error) {
      console.error('[ERROR] while seraching for existing correspondent:', error.message);
      throw error;
  }
}

async searchForExistingCorrespondent(correspondent) {
  try {
      const response = await this.client.get('/correspondents/', {
          params: {
              name__icontains: correspondent
          }
      });

      const results = response.data.results;
      
      if (results.length === 0) {
          console.log(`[DEBUG] No correspondent with name "${correspondent}" found`);
          return null;
      }
      
      // Check for exact match in the results - thanks to @skius for the hint!
      const exactMatch = results.find(c => c.name.toLowerCase() === correspondent.toLowerCase());
      if (exactMatch) {
          console.log(`[DEBUG] Found exact match for correspondent "${correspondent}" with ID ${exactMatch.id}`);
          return {
              id: exactMatch.id,
              name: exactMatch.name
          };
      }

      // No exact match found, return null
      console.log(`[DEBUG] No exact match found for "${correspondent}"`);
      return null;

  } catch (error) {
      console.error('[ERROR] while searching for existing correspondent:', error.message);
      throw error;
  }
}

  async getOrCreateCorrespondent(name, options = {}) {
    this.initialize();
    
    // Check if we should restrict to existing correspondents
    // Explicitly check options first, then env var
    const restrictToExistingCorrespondents = options.restrictToExistingCorrespondents === true || 
                                           (options.restrictToExistingCorrespondents === undefined && 
                                            process.env.RESTRICT_TO_EXISTING_CORRESPONDENTS === 'yes');
    
    console.log(`[DEBUG] Processing correspondent with restrictToExistingCorrespondents=${restrictToExistingCorrespondents}`);
  
    try {
        // Search for the correspondent
        const existingCorrespondent = await this.searchForExistingCorrespondent(name);
        console.log("[DEBUG] Response Correspondent Search: ", existingCorrespondent);
    
        if (existingCorrespondent) {
            console.log(`[DEBUG] Found existing correspondent "${name}" with ID ${existingCorrespondent.id}`);
            return existingCorrespondent;
        }
        
        // If we're restricting to existing correspondents and none was found, return null
        if (restrictToExistingCorrespondents) {
            console.log(`[DEBUG] Correspondent "${name}" does not exist and restrictions are enabled, returning null`);
            return null;
        }
    
        // Create new correspondent only if restrictions are not enabled
        try {
            const createResponse = await this.client.post('/correspondents/', { 
                name: name 
            });
            console.log(`[DEBUG] Created new correspondent "${name}" with ID ${createResponse.data.id}`);
            return createResponse.data;
        } catch (createError) {
            if (createError.response?.status === 400 && 
                createError.response?.data?.error?.includes('unique constraint')) {
              
                // Race condition check - another process might have created it
                const retryResponse = await this.client.get('/correspondents/', {
                    params: { name: name }
                });
              
                const justCreatedCorrespondent = retryResponse.data.results.find(
                    c => c.name.toLowerCase() === name.toLowerCase()
                );
              
                if (justCreatedCorrespondent) {
                    console.log(`[DEBUG] Retrieved correspondent "${name}" after constraint error with ID ${justCreatedCorrespondent.id}`);
                    return justCreatedCorrespondent;
                }
            }
            throw createError;
        }
    } catch (error) {
        console.error(`[ERROR] Failed to process correspondent "${name}":`, error.message);
        throw error;
    }
}

async searchForExistingDocumentType(documentType) {
  try {
      const response = await this.client.get('/document_types/', {
          params: {
              name__icontains: documentType
          }
      });

      const results = response.data.results;
      
      if (results.length === 0) {
          console.log(`[DEBUG] No document type with name "${documentType}" found`);
          return null;
      }
      
      // Check for exact match in the results
      const exactMatch = results.find(dt => dt.name.toLowerCase() === documentType.toLowerCase());
      if (exactMatch) {
          console.log(`[DEBUG] Found exact match for document type "${documentType}" with ID ${exactMatch.id}`);
          return {
              id: exactMatch.id,
              name: exactMatch.name
          };
      }

      // No exact match found, return null
      console.log(`[DEBUG] No exact match found for "${documentType}"`);
      return null;

  } catch (error) {
      console.error('[ERROR] while searching for existing document type:', error.message);
      throw error;
  }
}

async getOrCreateDocumentType(name) {
  this.initialize();
  
  try {
      // Suche nach existierendem document_type
      const existingDocType = await this.searchForExistingDocumentType(name);
      console.log("[DEBUG] Response Document Type Search: ", existingDocType);
  
      if (existingDocType) {
          console.log(`[DEBUG] Found existing document type "${name}" with ID ${existingDocType.id}`);
          return existingDocType;
      }
  
      // Erstelle neuen document_type
      try {
          const createResponse = await this.client.post('/document_types/', { 
              name: name,
              matching_algorithm: 1, // 1 = ANY
              match: "",  // Optional: Kann später angepasst werden
              is_insensitive: true
          });
          console.log(`[DEBUG] Created new document type "${name}" with ID ${createResponse.data.id}`);
          return createResponse.data;
      } catch (createError) {
          if (createError.response?.status === 400 && 
              createError.response?.data?.error?.includes('unique constraint')) {
            
              // Race condition check
              const retryResponse = await this.client.get('/document_types/', {
                  params: { name: name }
              });
            
              const justCreatedDocType = retryResponse.data.results.find(
                  dt => dt.name.toLowerCase() === name.toLowerCase()
              );
            
              if (justCreatedDocType) {
                  console.log(`[DEBUG] Retrieved document type "${name}" after constraint error with ID ${justCreatedDocType.id}`);
                  return justCreatedDocType;
              }
          }
          throw createError;
      }
  } catch (error) {
      console.error(`[ERROR] Failed to process document type "${name}":`, error.message);
      throw error;
  }
}

  async removeUnusedTagsFromDocument(documentId, keepTagIds) {
    this.initialize();
    if (!this.client) return;
  
    try {
      logger.debug('Removing unused tags from document %s, keeping tags: %o', documentId, keepTagIds);
      
      // Hole aktuelles Dokument
      const currentDoc = await this.getDocument(documentId);
      
      // Finde Tags die entfernt werden sollen (die nicht in keepTagIds sind)
      const tagsToRemove = currentDoc.tags.filter(tagId => !keepTagIds.includes(tagId));
      
      if (tagsToRemove.length === 0) {
        logger.debug('No tags to remove');
        return currentDoc;
      }
  
      // Update das Dokument mit nur den zu behaltenden Tags
      const updateData = {
        tags: keepTagIds
      };
  
      // Führe das Update durch
      await this.client.patch(`/documents/${documentId}/`, updateData);
      logger.debug('Successfully removed %d tags from document %s', tagsToRemove.length, documentId);
      
      return await this.getDocument(documentId);
    } catch (error) {
      console.error(`[ERROR] Error removing unused tags from document ${documentId}:`, error.message);
      throw error;
    }
  }

  async getTagTextFromId(tagId) {
    this.initialize();
    try {
      const response = await this.client.get(`/tags/${tagId}/`);
      return response.data.name;
    } catch (error) {
      console.error(`[ERROR] fetching tag text for ID ${tagId}:`, error.message);
      return null;
    }
  }

  async getOwnUserID() {
    this.initialize();
    try {
        const response = await this.client.get('/users/', {
            params: {
                current_user: true,
                full_perms: true
            }
        });
        
        if (response.data.results && response.data.results.length > 0) {
            const userInfo = response.data.results;
            //filter for username by process.env.PAPERLESS_USERNAME
            const user = userInfo.find(user => user.username === process.env.PAPERLESS_USERNAME);
            if (user) {
                logger.debug('Found own user ID: %s', user.id);
                return user.id;
            }
        }
        return null;
    } catch (error) {
        console.error('[ERROR] fetching own user ID:', error.message);
        return null;
    }
}
  //Remove if not needed?
  async getOwnerOfDocument(documentId) {
    this.initialize();
    try {
      const response = await this.client.get(`/documents/${documentId}/`);
      return response.data.owner;
    } catch (error) {
      console.error(`[ERROR] fetching owner of document ${documentId}:`, error.message);
      return null;
    }
  }

  // Checks if the document is accessable by the current user
  async getPermissionOfDocument(documentId) {
    this.initialize();
    try {
      const response = await this.client.get(`/documents/${documentId}/`);
      return response.data.user_can_change;
    } catch (error) {
      console.error(`[ERROR] No Permission to edit document ${documentId}:`, error.message);
      return null;
    }
  }


  async updateDocument(documentId, updates, options = { triggerFilenameReprocess: true, requestId: null }) {
    this.initialize();
    if (!this.client) return;
    const requestId = options.requestId || null;
    try {
      const currentDoc = await this.getDocument(documentId);
      
      if (updates.tags) {
        logger.debug('Current tags for document %s: %o', documentId, currentDoc.tags);
        logger.debug('Adding new tags: %o', updates.tags);
        logger.debug('Current correspondent: %o', currentDoc.correspondent);
        logger.debug('New correspondent: %o', updates.correspondent);
                
        const combinedTags = [...new Set([...currentDoc.tags, ...updates.tags])];
        updates.tags = combinedTags;
        
        logger.debug('Combined tags: %o', combinedTags);
      }

      if (currentDoc.correspondent && updates.correspondent) {
        logger.debug('Document already has a correspondent, keeping existing one: %o', currentDoc.correspondent);
        delete updates.correspondent;
      }

      let updateData;
      try {
        if (updates.created) {
          let dateObject;
          
          dateObject = parseISO(updates.created);
          
          if (!isValid(dateObject)) {
            dateObject = parse(updates.created, 'dd.MM.yyyy', new Date());
            if (!isValid(dateObject)) {
              dateObject = parse(updates.created, 'dd-MM-yyyy', new Date());
            }
          }
          
          if (!isValid(dateObject)) {
            console.warn(`[WARN] Invalid date format: ${updates.created}, using fallback date: 01.01.1990`);
            dateObject = new Date(1990, 0, 1);
          }
      
          updateData = {
            ...updates,
            created: format(dateObject, 'yyyy-MM-dd'),
          };
        } else {
          updateData = { ...updates };
        }
      } catch (error) {
        console.warn('[WARN] Error parsing date:', error.message);
        console.warn('[DEBUG] Received Date:', updates);
        updateData = {
          ...updates,
          created: format(new Date(1990, 0, 1), 'yyyy-MM-dd'),
        };
      }

<<<<<<< HEAD
      // Handle custom fields update (safe, idempotent)
      if (updateData.custom_fields) {
        logger.debug('Custom fields update detected', { documentId });
        try {
          // Try to delete existing custom fields (preferred) - some Paperless API versions provide this endpoint
          try {
            await this.client.delete(`/documents/${documentId}/custom_fields/`);
            logger.debug('Deleted existing custom fields for document %s', documentId);
          } catch (delError) {
            // Fallback: clear via patching an empty array
            logger.debug('Could not delete custom fields, attempting to clear via patch', { documentId, error: delError.message });
            await this.client.patch(`/documents/${documentId}/`, { custom_fields: [] });
          }

          // Ensure provided custom_fields are in the expected format (array of objects)
          if (!Array.isArray(updateData.custom_fields)) {
            logger.warn('custom_fields should be an array; attempting to convert', { documentId });
            // Attempt to coerce an object map into array
            if (typeof updateData.custom_fields === 'object' && updateData.custom_fields !== null) {
              updateData.custom_fields = Object.entries(updateData.custom_fields).map(([name, value]) => ({ name, value }));
            } else {
              // If we can't coerce, clear to empty array to avoid breaking the API
              updateData.custom_fields = [];
            }
          }

          // Some Paperless deployments accept direct patching with custom_fields payload
          // We'll include `custom_fields` as part of the normal patch payload below (apiPayload)
        } catch (err) {
          logger.warn('Failed to normalize or clear existing custom fields for document %s: %s', documentId, err.message);
          // Do not fail the whole update; proceed without custom_fields modifications
          delete updateData.custom_fields;
        }
      }
      
      // Validate title length before sending to API
      if (updateData.title && updateData.title.length > 128) {
        updateData.title = updateData.title.substring(0, 124) + '…';
        console.warn(`[WARN] Title truncated to 128 characters for document ${documentId}`);
      }

      // Filter out internal metadata fields (starting with _) and document_id
      const apiPayload = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (!key.startsWith('_') && key !== 'document_id' && value !== null && value !== undefined) {
          apiPayload[key] = value;
        }
      }

      logger.debug('Final update data: %o', apiPayload);
      // Propagate request-id if provided to Paperless API
      const headers = {};
      if (requestId) headers['X-Request-Id'] = requestId;
      await this.client.patch(`/documents/${documentId}/`, apiPayload, { headers });
      logger.info('Updated document %s with: %o', documentId, updateData, { requestId });
      if (options.triggerFilenameReprocess !== false &&
          this._shouldTriggerFilenameReprocess(apiPayload)) {
        try {
          await this.reprocessDocuments([documentId]);
          logger.debug('[PAPERLESS] Reprocess triggered for filename format', {
            documentId
          });
        } catch (reprocessError) {
          logger.warn('[PAPERLESS] Reprocess failed after update', {
            documentId,
            error: reprocessError.message
          });
        }
      }
      return await this.getDocument(documentId);
    } catch (error) {
      // Log concise error info instead of entire Axios error object
      const errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      };
      logger.error('Error updating document %s: %o', documentId, errorDetails);
      return null;
    }
  }

  async downloadOriginalDocument(documentId) {
    this.initialize();
    if (!this.client) {
      logger.warn('[PAPERLESS] Client not initialized for original download');
      return null;
    }

    try {
      const response = await this.client.get(`/documents/${documentId}/download/original/`, {
        responseType: 'arraybuffer'
      });

      if (!response?.data) {
        logger.warn(`[PAPERLESS] Empty original download for document ${documentId}`);
        return null;
      }

      const buf = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
      // Quick validation: ensure the original download looks like a PDF. If not, fall back
      // to the standard download endpoint to avoid feeding HTML/JSON into PDF tools.
      try {
        const header = buf.slice(0, 4).toString('utf8');
        if (!header.startsWith('%PDF')) {
          let extraInfo = '';
          try {
            // Try to parse the buffer as JSON to give more info (e.g. error message from API)
            const textContent = buf.toString('utf8');
            if (textContent.trim().startsWith('{')) {
              const json = JSON.parse(textContent);
              extraInfo = ` - Content: ${JSON.stringify(json)}`;
            }
          } catch (ignored) {
            // ignore
          }
          logger.warn(`[PAPERLESS] Original download for document ${documentId} does not appear to be PDF (header=${header})${extraInfo}, falling back.`);
          return null;
        }
      } catch (e) {
        // If header check fails, fall back gracefully
        logger.warn(`[PAPERLESS] Could not validate original download header for document ${documentId}: ${e.message}`);
        return null;
      }

      return buf;
    } catch (error) {
      console.error(`[PAPERLESS] Error downloading original document ${documentId}:`, error.message);
      if (error.response) {
        console.log('[PAPERLESS] status:', error.response.status);
        console.log('[PAPERLESS] headers:', error.response.headers);
      }
      return null;
    }
  }

  _getFilenameFormatTokens(format) {
    if (!format || typeof format !== 'string') return new Set();
    const tokens = new Set();
    const regex = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
    let match;
    while ((match = regex.exec(format))) {
      tokens.add(match[1].toLowerCase());
    }
    return tokens;
  }

  _shouldTriggerFilenameReprocess(apiPayload) {
    const format = process.env.PAPERLESS_FILENAME_FORMAT;
    if (!format || !apiPayload || typeof apiPayload !== 'object') return false;
    const tokens = this._getFilenameFormatTokens(format);
    if (tokens.size === 0) return false;

    const hasKey = (key) => Object.prototype.hasOwnProperty.call(apiPayload, key);
    const usesCreated = Array.from(tokens).some(token => token === 'created' || token.startsWith('created_'));

    if (tokens.has('title') && hasKey('title')) return true;
    if (tokens.has('correspondent') && hasKey('correspondent')) return true;
    if (usesCreated && hasKey('created')) return true;
    if (tokens.has('document_type') && hasKey('document_type')) return true;
    if (tokens.has('tags') && hasKey('tags')) return true;

    return false;
  }

  async reprocessDocuments(documentIds) {
    this.initialize();
    if (!this.client) return false;
    const ids = Array.isArray(documentIds) ? documentIds : [documentIds];
    const filtered = ids.filter(id => Number.isInteger(Number(id)));
    if (filtered.length === 0) return false;
    try {
      await this.client.post('/documents/bulk_edit/', {
        documents: filtered,
        method: 'reprocess'
      });
      return true;
    } catch (error) {
      console.error('[PAPERLESS] Error reprocessing documents:', error.message);
      return false;
    }
  }
}


module.exports = new PaperlessService();
