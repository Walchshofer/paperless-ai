/**
 * NormalizationStore.js
 *
 * Manages persistence of normalized document images.
 * Follows Hybrid SOT pattern: files on disk, metadata in Paperless custom fields.
 *
 * Storage layout:
 *   /app/data/normalized/{docId}/page_{n}.png
 *
 * Custom Fields:
 *   - ai_normalized_url: URL to first page (primary)
 *   - ai_normalization_status: pending | processing | completed | failed | skipped
 *   - ai_normalization_meta: JSON with geometry, actions, timestamp
 *
 * @see docs/AUTOMATIC_NORMALIZATION_PLAN.md
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');
const {
  normalizationTotal,
  normalizationLatency,
  normalizationDiskUsage
} = require('../metrics/normalizationMetrics');

// Status enum values - must match Paperless custom field select_options
const NORMALIZATION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

// Custom field names
const FIELD_NAMES = {
  URL: 'ai_normalized_url',
  STATUS: 'ai_normalization_status',
  META: 'ai_normalization_meta'
};

/**
 * NormalizationStore - Manages normalized image persistence and metadata
 */
class NormalizationStore {
  /**
   * Create a NormalizationStore instance
   * @param {Object} options - Configuration options
   * @param {string} [options.baseDir] - Base directory for normalized images
   * @param {Object} [options.paperlessService] - PaperlessService instance
   * @param {Object} [options.logger] - Logger instance
   */
  constructor(options = {}) {
    // Default base directory matches existing /app/data mount (no new volume needed)
    this.baseDir = options.baseDir ||
      process.env.NORMALIZED_IMAGES_DIR ||
      '/app/data/normalized';

    // Lazy-load paperlessService if not provided
    this._paperlessService = options.paperlessService || null;
    this._logger = options.logger || logger;

    // Stats tracking
    this._stats = {
      stored: 0,
      updated: 0,
      errors: 0,
      lastOperation: null
    };
  }

  /**
   * Get paperlessService instance (lazy-loaded)
   * @returns {Object} PaperlessService instance
   */
  get paperlessService() {
    if (!this._paperlessService) {
      this._paperlessService = require('../paperlessService');
    }
    return this._paperlessService;
  }

  /**
   * Ensure the base directory exists
   * @returns {Promise<void>}
   */
  async ensureBaseDir() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
  }

  /**
   * Get the directory path for a document's normalized images
   * @param {number|string} docId - Document ID
   * @returns {string} Directory path
   */
  getDocDir(docId) {
    return path.join(this.baseDir, String(docId));
  }

  /**
   * Get the file path for a specific page
   * @param {number|string} docId - Document ID
   * @param {number} page - Page number (1-indexed)
   * @param {string} [format='png'] - Image format
   * @returns {string} File path
   */
  getPagePath(docId, page, format = 'png') {
    return path.join(this.getDocDir(docId), `page_${page}.${format}`);
  }

  /**
   * Store normalized pages for a document
   *
   * Writes image files to disk, then updates Paperless metadata.
   * File write happens FIRST to prevent orphaned metadata (invariant).
   *
   * @param {number} docId - Document ID
   * @param {Array<{page: number, buffer: Buffer}|{page: number, base64: string}>} pages - Normalized pages
   * @param {Object} [metadata={}] - Normalization metadata (geometry, actions)
   * @returns {Promise<{success: boolean, url: string, pageCount: number, error?: string}>}
   */
  async store(docId, pages, metadata = {}) {
    if (!docId || !Number.isFinite(Number(docId)) || Number(docId) <= 0) {
      return { success: false, error: 'Invalid document ID', pageCount: 0 };
    }

    if (!Array.isArray(pages) || pages.length === 0) {
      return { success: false, error: 'No pages provided', pageCount: 0 };
    }

    const docDir = this.getDocDir(docId);
    const log = this._logger;
    const startTime = Date.now();

    try {
      // Step 1: Ensure document directory exists
      await fs.mkdir(docDir, { recursive: true });

      // Step 2: Write all page files (BEFORE updating metadata - invariant)
      const writtenPages = [];
      for (const pageData of pages) {
        const pageNum = pageData.page || writtenPages.length + 1;
        const filePath = this.getPagePath(docId, pageNum);

        // Support both Buffer and base64 input
        let buffer;
        if (Buffer.isBuffer(pageData.buffer)) {
          buffer = pageData.buffer;
        } else if (typeof pageData.base64 === 'string') {
          buffer = Buffer.from(pageData.base64, 'base64');
        } else if (Buffer.isBuffer(pageData)) {
          buffer = pageData;
        } else {
          log.warn({
            event: 'normalization_store_invalid_page',
            docId,
            pageNum,
            type: typeof pageData
          });
          continue;
        }

        await fs.writeFile(filePath, buffer);
        
        // Validate written file integrity (basic size check)
        try {
          const stats = await fs.stat(filePath);
          if (stats.size !== buffer.length) {
            log.warn({
              event: 'normalization_file_size_mismatch',
              docId,
              pageNum,
              expected: buffer.length,
              actual: stats.size
            });
            // Don't fail, but log for monitoring
          }
          
          // Validate PNG header (89 50 4E 47 = PNG magic bytes)
          const fileHeader = await fs.readFile(filePath, { encoding: null, flag: 'r' });
          const pngMagic = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
          if (!fileHeader.slice(0, 4).equals(pngMagic)) {
            log.error({
              event: 'normalization_invalid_png_header',
              docId,
              pageNum,
              header: fileHeader.slice(0, 8).toString('hex')
            });
            // Skip corrupted file
            continue;
          }
        } catch (validationErr) {
          log.warn({
            event: 'normalization_validation_failed',
            docId,
            pageNum,
            error: validationErr.message
          });
          // Continue despite validation failure to maintain backward compatibility
        }
        
        writtenPages.push({ page: pageNum, path: filePath, size: buffer.length });

        log.debug({
          event: 'normalization_page_written',
          docId,
          pageNum,
          size: buffer.length
        });
      }

      if (writtenPages.length === 0) {
        return { success: false, error: 'No valid pages written', pageCount: 0 };
      }

      // Step 3: Build URL for first page (primary URL)
      // URL is relative to API base - frontend constructs full URL
      const primaryUrl = `/api/normalized/${docId}/1`;

      // Step 4: Update Paperless custom fields (AFTER file write - invariant)
      const metaPayload = {
        ...metadata,
        timestamp: new Date().toISOString(),
        pageCount: writtenPages.length,
        pages: writtenPages.map(p => ({
          page: p.page,
          size: p.size
        }))
      };

      const updateResult = await this.updatePaperlessMetadata(
        docId,
        NORMALIZATION_STATUS.COMPLETED,
        primaryUrl,
        metaPayload
      );

      if (!updateResult.success) {
        log.warn({
          event: 'normalization_metadata_update_failed',
          docId,
          error: updateResult.error
        });
        // Files are written but metadata failed - log but don't fail entirely
        // This prevents data loss; metadata can be retried
      }

      this._stats.stored++;
      this._stats.lastOperation = new Date().toISOString();

      // Record metrics
      const latency = (Date.now() - startTime) / 1000; // Convert to seconds
      normalizationLatency.labels({ stage: 'persistence' }).observe(latency);
      normalizationTotal.labels({
        status: 'success',
        trigger: metadata.source || 'unknown'
      }).inc();

      // Update disk usage gauge
      const stats = await this.getStats();
      normalizationDiskUsage.set(stats.diskUsageBytes / (1024 * 1024)); // Convert to MB

      log.info({
        event: 'normalization_store_success',
        docId,
        pageCount: writtenPages.length,
        url: primaryUrl
      });

      return {
        success: true,
        url: primaryUrl,
        pageCount: writtenPages.length
      };

    } catch (err) {
      this._stats.errors++;

      // Record metrics
      const latency = (Date.now() - startTime) / 1000;
      normalizationLatency.labels({ stage: 'persistence' }).observe(latency);
      normalizationTotal.labels({
        status: 'failed',
        trigger: metadata.source || 'unknown'
      }).inc();

      log.error({
        event: 'normalization_store_error',
        docId,
        error: err.message
      });

      // Attempt to update status to failed
      try {
        await this.updatePaperlessMetadata(
          docId,
          NORMALIZATION_STATUS.FAILED,
          null,
          { error: err.message, timestamp: new Date().toISOString() }
        );
      } catch (metaErr) {
        log.warn({
          event: 'normalization_status_update_failed',
          docId,
          error: metaErr.message
        });
      }

      throw err;
    }
  }

  /**
   * Check if a document has been normalized successfully
   *
   * Checks Paperless custom field first, falls back to disk check.
   *
   * @param {number} docId - Document ID
   * @returns {Promise<boolean>}
   */
  async isNormalized(docId) {
    if (!docId || !Number.isFinite(Number(docId)) || Number(docId) <= 0) {
      return false;
    }

    try {
      // Primary check: Paperless custom field
      const status = await this.getStatus(docId);
      if (status && status.status === NORMALIZATION_STATUS.COMPLETED) {
        return true;
      }

      // Fallback: Check if files exist on disk
      const page1Path = this.getPagePath(docId, 1);
      try {
        await fs.access(page1Path);
        this._logger.debug({
          event: 'normalization_found_on_disk',
          docId,
          path: page1Path
        });
        return true;
      } catch {
        return false;
      }
    } catch (err) {
      this._logger.warn({
        event: 'normalization_check_error',
        docId,
        error: err.message
      });

      // Fallback to disk check on API error
      const page1Path = this.getPagePath(docId, 1);
      try {
        await fs.access(page1Path);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Get normalization status for a document
   *
   * @param {number} docId - Document ID
   * @returns {Promise<{status: string|null, url: string|null, meta: Object|null}>}
   */
  async getStatus(docId) {
    if (!docId || !Number.isFinite(Number(docId)) || Number(docId) <= 0) {
      return { status: null, url: null, meta: null };
    }

    try {
      const doc = await this.paperlessService.getDocument(docId);

      if (!doc || !doc.custom_fields) {
        return { status: null, url: null, meta: null };
      }

      // Extract custom field values
      // custom_fields can be array of {field: id, value: val} or object
      let status = null;
      let url = null;
      let meta = null;

      const extractFieldValue = (fieldName) => {
        if (Array.isArray(doc.custom_fields)) {
          const field = doc.custom_fields.find(cf => {
            // Check by field name if resolved, or need to resolve by ID
            return cf.name === fieldName ||
              cf.field_name === fieldName ||
              String(cf.name).toLowerCase() === fieldName.toLowerCase();
          });
          return field?.value ?? null;
        } else if (typeof doc.custom_fields === 'object') {
          return doc.custom_fields[fieldName] ?? null;
        }
        return null;
      };

      status = extractFieldValue(FIELD_NAMES.STATUS);
      url = extractFieldValue(FIELD_NAMES.URL);
      const metaStr = extractFieldValue(FIELD_NAMES.META);

      // Parse meta JSON
      if (metaStr && typeof metaStr === 'string') {
        try {
          meta = JSON.parse(metaStr);
        } catch {
          this._logger.warn({
            event: 'normalization_meta_parse_error',
            docId,
            raw: metaStr.substring(0, 100)
          });
          meta = { raw: metaStr };
        }
      } else if (typeof metaStr === 'object') {
        meta = metaStr;
      }

      return { status, url, meta };

    } catch (err) {
      this._logger.warn({
        event: 'normalization_get_status_error',
        docId,
        error: err.message
      });
      return { status: null, url: null, meta: null };
    }
  }

  /**
   * Update Paperless custom fields with normalization info
   *
   * @param {number} docId - Document ID
   * @param {string} status - Status value (from NORMALIZATION_STATUS)
   * @param {string|null} url - Normalized image URL
   * @param {Object|null} meta - Metadata object (will be JSON.stringify'd)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async updatePaperlessMetadata(docId, status, url, meta) {
    if (!docId || !Number.isFinite(Number(docId)) || Number(docId) <= 0) {
      return { success: false, error: 'Invalid document ID' };
    }

    // Validate status value
    const validStatuses = Object.values(NORMALIZATION_STATUS);
    if (!validStatuses.includes(status)) {
      return { success: false, error: `Invalid status: ${status}` };
    }

    try {
      // Build custom_fields array for update
      const customFields = [
        { name: FIELD_NAMES.STATUS, value: status }
      ];

      if (url !== null && url !== undefined) {
        customFields.push({ name: FIELD_NAMES.URL, value: url });
      }

      if (meta !== null && meta !== undefined) {
        // Ensure meta is stringified JSON (invariant)
        const metaStr = typeof meta === 'string' ? meta : JSON.stringify(meta);
        customFields.push({ name: FIELD_NAMES.META, value: metaStr });
      }

      // Use paperlessService.updateDocument to update custom fields
      const result = await this.paperlessService.updateDocument(docId, {
        custom_fields: customFields
      }, {
        triggerFilenameReprocess: false,
        requestId: `normalization-${docId}-${Date.now()}`
      });

      if (result) {
        this._stats.updated++;
        this._logger.debug({
          event: 'normalization_metadata_updated',
          docId,
          status
        });
        return { success: true };
      } else {
        return { success: false, error: 'Update returned null' };
      }

    } catch (err) {
      this._logger.error({
        event: 'normalization_metadata_update_error',
        docId,
        error: err.message
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Get statistics about normalization store
   *
   * @returns {Promise<{totalDocuments: number, diskUsageBytes: number, lastOperation: string|null}>}
   */
  async getStats() {
    const stats = {
      totalDocuments: 0,
      diskUsageBytes: 0,
      lastOperation: this._stats.lastOperation,
      stored: this._stats.stored,
      updated: this._stats.updated,
      errors: this._stats.errors
    };

    try {
      // Check if base directory exists
      try {
        await fs.access(this.baseDir);
      } catch {
        // Directory doesn't exist yet - return zeros
        return stats;
      }

      // Count document directories and calculate disk usage
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          stats.totalDocuments++;

          // Calculate directory size
          const docDir = path.join(this.baseDir, entry.name);
          try {
            const files = await fs.readdir(docDir);
            for (const file of files) {
              try {
                const fileStat = await fs.stat(path.join(docDir, file));
                stats.diskUsageBytes += fileStat.size;
              } catch {
                // Skip files we can't stat
              }
            }
          } catch {
            // Skip directories we can't read
          }
        }
      }

    } catch (err) {
      this._logger.warn({
        event: 'normalization_stats_error',
        error: err.message
      });
      // Return partial stats on error (non-fatal)
    }

    return stats;
  }

  /**
   * Delete normalized images for a document
   *
   * @param {number} docId - Document ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async delete(docId) {
    if (!docId || !Number.isFinite(Number(docId)) || Number(docId) <= 0) {
      return { success: false, error: 'Invalid document ID' };
    }

    const docDir = this.getDocDir(docId);

    try {
      await fs.rm(docDir, { recursive: true, force: true });

      // Clear Paperless metadata
      await this.updatePaperlessMetadata(
        docId,
        NORMALIZATION_STATUS.PENDING,
        null,
        { deleted: true, timestamp: new Date().toISOString() }
      );

      this._logger.info({
        event: 'normalization_deleted',
        docId
      });

      return { success: true };

    } catch (err) {
      if (err.code === 'ENOENT') {
        // Directory didn't exist - not an error
        return { success: true };
      }

      this._logger.error({
        event: 'normalization_delete_error',
        docId,
        error: err.message
      });

      return { success: false, error: err.message };
    }
  }
}

// Export class, status enum, and field names
module.exports = {
  NormalizationStore,
  NORMALIZATION_STATUS,
  FIELD_NAMES
};
