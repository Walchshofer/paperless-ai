const crypto = require('crypto');
const config = require('../config/config');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const sharp = require('sharp');

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'duplicate_fingerprints.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS duplicate_fingerprints (
    document_id INTEGER PRIMARY KEY,
    page_count INTEGER,
    page_hashes TEXT,
    content_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS duplicate_map (
    duplicate_doc_id INTEGER PRIMARY KEY,
    original_doc_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const upsertFingerprint = db.prepare(`
  INSERT INTO duplicate_fingerprints (document_id, page_count, page_hashes, content_hash)
  VALUES (@document_id, @page_count, @page_hashes, @content_hash)
  ON CONFLICT(document_id) DO UPDATE SET
    page_count = excluded.page_count,
    page_hashes = excluded.page_hashes,
    content_hash = excluded.content_hash
`);
const deleteFingerprint = db.prepare(`DELETE FROM duplicate_fingerprints WHERE document_id = ?`);
const upsertDuplicateMap = db.prepare(`
  INSERT INTO duplicate_map (duplicate_doc_id, original_doc_id)
  VALUES (@duplicate_doc_id, @original_doc_id)
  ON CONFLICT(duplicate_doc_id) DO UPDATE SET
    original_doc_id = excluded.original_doc_id
`);
const deleteDuplicateMap = db.prepare(`DELETE FROM duplicate_map WHERE duplicate_doc_id = ?`);

/**
 * Detects duplicate and partial-duplicate documents using perceptual hashing.
 * Runs at ingestion time before AI processing to avoid redundant compute.
 */
class DuplicateDetector {
    constructor() {
        this.fingerprints = new Map();
        this.duplicateMap = new Map(); // docId -> originalDocId
        this.similarityThreshold = config.duplicateDetection?.similarityThreshold ?? 0.95;
        this.maxPagesToCompare = config.duplicateDetection?.maxPagesToCompare ?? 10;
        this._loadPersistedData();
    }

    /**
     * Generate fingerprint for a document based on page hashes
     * @param {number} documentId - Paperless document ID
     * @param {Array<Buffer>} pageImages - Rendered page images as buffers
     * @returns {Object} Document fingerprint
     */
    async generateFingerprint(documentId, pageImages) {
        const pageHashes = [];
        const pagesToCompare = pageImages.slice(0, this.maxPagesToCompare);

        for (let i = 0; i < pagesToCompare.length; i++) {
            const hash = await this._computePerceptualHash(pagesToCompare[i]);
            pageHashes.push({
                pageIndex: i,
                hash,
                size: pagesToCompare[i].length
            });
        }

        return {
            documentId,
            pageCount: pagesToCompare.length,
            pageHashes,
            contentHash: this._computeContentHash(pageHashes),
            createdAt: new Date().toISOString()
        };
    }

    /**
     * Compute perceptual hash (dHash) for an image
     * dHash is resistant to minor variations in scanning/compression
     * @param {Buffer} imageBuffer - Image buffer
     * @returns {string} 64-bit hash as hex string
     */
    async _computePerceptualHash(imageBuffer) {
        try {
            const resized = await sharp(imageBuffer)
                .resize(9, 8, { fit: 'fill' })
                .grayscale()
                .raw()
                .toBuffer();

            const bits = [];
            for (let y = 0; y < 8; y += 1) {
                for (let x = 0; x < 8; x += 1) {
                    const left = resized[(y * 9) + x];
                    const right = resized[(y * 9) + x + 1];
                    bits.push(left > right ? 1 : 0);
                }
            }

            let hex = '';
            for (let i = 0; i < bits.length; i += 4) {
                const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
                hex += nibble.toString(16);
            }
            return hex;
        } catch (error) {
            console.warn(`[DUPLICATE_DETECTOR] dHash failed, falling back to byte hash: ${error.message}`);
            return crypto.createHash('sha256').update(imageBuffer).digest('hex').substring(0, 16);
        }
    }

    /**
     * Compute content hash from page hashes for quick comparison
     * @param {Array} pageHashes - Array of page hash objects
     * @returns {string} Combined content hash
     */
    _computeContentHash(pageHashes) {
        const combined = pageHashes.map(p => p.hash).join('');
        return crypto.createHash('sha256').update(combined).digest('hex');
    }

    /**
     * Check if document is a duplicate or partial duplicate
     * @param {Object} newFingerprint - Fingerprint of new document
     * @returns {Object} Duplicate check result
     */
    async checkDuplicate(newFingerprint) {
        const result = {
            isDuplicate: false,
            isPartialDuplicate: false,
            duplicateType: null,
            originalDocumentId: null,
            action: 'process', // 'process' | 'skip' | 'replace'
            reason: null
        };

        for (const [existingDocId, existingFp] of this.fingerprints) {
            if (existingDocId === newFingerprint.documentId) continue;

            const comparison = this._compareFingerprints(newFingerprint, existingFp);

            if (comparison.isExactDuplicate) {
                result.isDuplicate = true;
                result.duplicateType = 'exact';
                result.originalDocumentId = existingDocId;
                result.action = 'skip';
                result.reason = `Exact duplicate of document ${existingDocId}`;
                break;
            }

            if (comparison.isPartialDuplicate) {
                result.isPartialDuplicate = true;
                result.duplicateType = 'partial';
                result.originalDocumentId = existingDocId;

                if (newFingerprint.pageCount > existingFp.pageCount) {
                    result.action = 'replace';
                    result.reason = `New document (${newFingerprint.pageCount} pages) is superset of document ${existingDocId} (${existingFp.pageCount} pages)`;
                } else {
                    result.action = 'skip';
                    result.reason = `Document ${existingDocId} (${existingFp.pageCount} pages) is superset of new document (${newFingerprint.pageCount} pages)`;
                }
                break;
            }
        }

        return result;
    }

    /**
     * Compare two fingerprints for duplicate detection
     * @param {Object} fpA - First fingerprint
     * @param {Object} fpB - Second fingerprint
     * @returns {Object} Comparison result
     */
    _compareFingerprints(fpA, fpB) {
        const result = {
            isExactDuplicate: false,
            isPartialDuplicate: false,
            matchingPages: 0,
            similarity: 0
        };

        if (fpA.contentHash === fpB.contentHash) {
            result.isExactDuplicate = true;
            result.matchingPages = fpA.pageCount;
            result.similarity = 1.0;
            return result;
        }

        const [shorter, longer] = fpA.pageCount <= fpB.pageCount
            ? [fpA, fpB]
            : [fpB, fpA];

        let matchingPages = 0;
        for (let i = 0; i < shorter.pageHashes.length; i++) {
            const shortHash = shorter.pageHashes[i].hash;
            const longHash = longer.pageHashes[i]?.hash;

            if (shortHash === longHash) {
                matchingPages++;
            } else {
                break;
            }
        }

        result.matchingPages = matchingPages;
        result.similarity = shorter.pageCount > 0 ? matchingPages / shorter.pageCount : 0;

        if (result.similarity >= this.similarityThreshold && longer.pageCount > shorter.pageCount) {
            result.isPartialDuplicate = true;
        }

        return result;
    }

    /**
     * Register a document fingerprint (after deciding to process it)
     * @param {Object} fingerprint - Document fingerprint
     */
    registerFingerprint(fingerprint) {
        this.fingerprints.set(fingerprint.documentId, fingerprint);
        try {
            upsertFingerprint.run({
                document_id: fingerprint.documentId,
                page_count: fingerprint.pageCount,
                page_hashes: JSON.stringify(fingerprint.pageHashes || []),
                content_hash: fingerprint.contentHash
            });
        } catch (error) {
            console.error(`[DUPLICATE_DETECTOR] Failed to persist fingerprint for ${fingerprint.documentId}:`, error.message);
        }
        console.log(`[DUPLICATE_DETECTOR] Registered fingerprint for document ${fingerprint.documentId} (${fingerprint.pageCount} pages)`);
    }

    /**
     * Mark a document as duplicate of another
     * @param {number} duplicateDocId - The duplicate document ID
     * @param {number} originalDocId - The original document ID
     */
    markAsDuplicate(duplicateDocId, originalDocId) {
        this.duplicateMap.set(duplicateDocId, originalDocId);
        try {
            upsertDuplicateMap.run({ duplicate_doc_id: duplicateDocId, original_doc_id: originalDocId });
        } catch (error) {
            console.error(`[DUPLICATE_DETECTOR] Failed to persist duplicate mapping for ${duplicateDocId}:`, error.message);
        }
        console.log(`[DUPLICATE_DETECTOR] Marked document ${duplicateDocId} as duplicate of ${originalDocId}`);
    }

    /**
     * Remove fingerprint when document is deleted or replaced
     * @param {number} documentId - Document ID to remove
     */
    removeFingerprint(documentId) {
        this.fingerprints.delete(documentId);
        this.duplicateMap.delete(documentId);
        try {
            deleteFingerprint.run(documentId);
            deleteDuplicateMap.run(documentId);
        } catch (error) {
            console.error(`[DUPLICATE_DETECTOR] Failed to delete fingerprint for ${documentId}:`, error.message);
        }
    }

    /**
     * Check if a document is already marked as duplicate
     * @param {number} documentId - Document ID
     * @returns {number|null} Original document ID or null
     */
    getDuplicateOf(documentId) {
        return this.duplicateMap.get(documentId) || null;
    }

    /**
     * Get statistics about duplicate detection
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            registeredDocuments: this.fingerprints.size,
            markedDuplicates: this.duplicateMap.size,
            cacheMemoryEstimate: `${Math.round(this.fingerprints.size * 0.5)}KB`
        };
    }

    _loadPersistedData() {
        try {
            const fingerprintRows = db.prepare(`SELECT * FROM duplicate_fingerprints`).all();
            for (const row of fingerprintRows) {
                const pageHashes = row.page_hashes ? JSON.parse(row.page_hashes) : [];
                this.fingerprints.set(row.document_id, {
                    documentId: row.document_id,
                    pageCount: row.page_count,
                    pageHashes,
                    contentHash: row.content_hash,
                    createdAt: row.created_at
                });
            }

            const duplicateRows = db.prepare(`SELECT * FROM duplicate_map`).all();
            for (const row of duplicateRows) {
                this.duplicateMap.set(row.duplicate_doc_id, row.original_doc_id);
            }
        } catch (error) {
            console.error('[DUPLICATE_DETECTOR] Failed to load persisted fingerprints:', error.message);
        }
    }
}

module.exports = new DuplicateDetector();
