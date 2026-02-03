/* eslint-env mocha */
/**
 * test/unit/NormalizationStore.test.js
 *
 * Unit tests for NormalizationStore service.
 * Tests file I/O and Paperless metadata operations with mocks.
 *
 * @see services/normalization/NormalizationStore.js
 */

const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

// Import the module under test
const {
  NormalizationStore,
  NORMALIZATION_STATUS,
  FIELD_NAMES
} = require('../../services/normalization/NormalizationStore');

describe('NormalizationStore', function() {
  this.timeout(10000);

  // Test fixtures
  let tempDir;
  let store;
  let mockPaperlessService;
  let mockLogger;

  // Mock document data
  const testDocId = 12345;
  const testPage1Buffer = Buffer.from('fake-png-data-page-1');
  const testPage2Buffer = Buffer.from('fake-png-data-page-2');
  const testBase64Page = Buffer.from('fake-base64-page').toString('base64');

  beforeEach(async function() {
    // Create temp directory for test files
    tempDir = path.join(os.tmpdir(), `normalization-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create mock logger
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      _logs: []
    };
    // Capture logs for assertions
    ['debug', 'info', 'warn', 'error'].forEach(level => {
      mockLogger[level] = (obj) => {
        mockLogger._logs.push({ level, ...obj });
      };
    });

    // Create mock paperlessService
    mockPaperlessService = {
      _documents: new Map(),
      _customFields: new Map([
        [FIELD_NAMES.STATUS, { id: 100, name: FIELD_NAMES.STATUS }],
        [FIELD_NAMES.URL, { id: 101, name: FIELD_NAMES.URL }],
        [FIELD_NAMES.META, { id: 102, name: FIELD_NAMES.META }]
      ]),
      _updateCalls: [],
      _shouldFail: false,
      _failMessage: '',

      async getDocument(docId) {
        if (this._shouldFail) {
          throw new Error(this._failMessage || 'Mock Paperless API error');
        }
        return this._documents.get(docId) || {
          id: docId,
          custom_fields: []
        };
      },

      async updateDocument(docId, updates, options) {
        if (this._shouldFail) {
          throw new Error(this._failMessage || 'Mock Paperless API error');
        }
        this._updateCalls.push({ docId, updates, options });

        // Store the update
        const existing = this._documents.get(docId) || { id: docId, custom_fields: [] };
        if (updates.custom_fields) {
          existing.custom_fields = updates.custom_fields;
        }
        this._documents.set(docId, existing);
        return existing;
      },

      async findExistingCustomField(fieldName) {
        return this._customFields.get(fieldName) || null;
      },

      reset() {
        this._documents.clear();
        this._updateCalls = [];
        this._shouldFail = false;
        this._failMessage = '';
      }
    };

    // Create store instance with mocks
    store = new NormalizationStore({
      baseDir: tempDir,
      paperlessService: mockPaperlessService,
      logger: mockLogger
    });
  });

  afterEach(async function() {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    mockPaperlessService.reset();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('constructor', function() {
    it('should use default baseDir when not provided', function() {
      const defaultStore = new NormalizationStore();
      assert.ok(defaultStore.baseDir);
      assert.strictEqual(typeof defaultStore.baseDir, 'string');
    });

    it('should use provided baseDir', function() {
      const customDir = '/custom/normalized';
      const customStore = new NormalizationStore({ baseDir: customDir });
      assert.strictEqual(customStore.baseDir, customDir);
    });

    it('should use environment variable for baseDir', function() {
      const envDir = '/env/normalized';
      const originalEnv = process.env.NORMALIZED_IMAGES_DIR;
      process.env.NORMALIZED_IMAGES_DIR = envDir;

      try {
        const envStore = new NormalizationStore({});
        assert.strictEqual(envStore.baseDir, envDir);
      } finally {
        if (originalEnv) {
          process.env.NORMALIZED_IMAGES_DIR = originalEnv;
        } else {
          delete process.env.NORMALIZED_IMAGES_DIR;
        }
      }
    });
  });

  // ==========================================================================
  // Path Helper Tests
  // ==========================================================================

  describe('path helpers', function() {
    it('getDocDir returns correct path', function() {
      const docDir = store.getDocDir(123);
      assert.strictEqual(docDir, path.join(tempDir, '123'));
    });

    it('getPagePath returns correct path for PNG', function() {
      const pagePath = store.getPagePath(123, 1, 'png');
      assert.strictEqual(pagePath, path.join(tempDir, '123', 'page_1.png'));
    });

    it('getPagePath returns correct path for WebP', function() {
      const pagePath = store.getPagePath(123, 2, 'webp');
      assert.strictEqual(pagePath, path.join(tempDir, '123', 'page_2.webp'));
    });
  });

  // ==========================================================================
  // store() Tests
  // ==========================================================================

  describe('store()', function() {
    it('should store a single page with Buffer', async function() {
      const pages = [{ page: 1, buffer: testPage1Buffer }];
      const metadata = { source: 'test' };

      const result = await store.store(testDocId, pages, metadata);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.pageCount, 1);
      assert.strictEqual(result.url, `/api/normalized/${testDocId}/1`);

      // Verify file was written
      const filePath = store.getPagePath(testDocId, 1);
      const fileContent = await fs.readFile(filePath);
      assert.deepStrictEqual(fileContent, testPage1Buffer);
    });

    it('should store multiple pages', async function() {
      const pages = [
        { page: 1, buffer: testPage1Buffer },
        { page: 2, buffer: testPage2Buffer }
      ];

      const result = await store.store(testDocId, pages, {});

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.pageCount, 2);

      // Verify both files exist
      const file1 = await fs.readFile(store.getPagePath(testDocId, 1));
      const file2 = await fs.readFile(store.getPagePath(testDocId, 2));
      assert.deepStrictEqual(file1, testPage1Buffer);
      assert.deepStrictEqual(file2, testPage2Buffer);
    });

    it('should store page from base64 string', async function() {
      const pages = [{ page: 1, base64: testBase64Page }];

      const result = await store.store(testDocId, pages, {});

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.pageCount, 1);

      // Verify decoded content
      const fileContent = await fs.readFile(store.getPagePath(testDocId, 1));
      assert.deepStrictEqual(fileContent, Buffer.from(testBase64Page, 'base64'));
    });

    it('should update Paperless metadata after storing', async function() {
      const pages = [{ page: 1, buffer: testPage1Buffer }];
      const metadata = { geometry: 'test-geometry' };

      await store.store(testDocId, pages, metadata);

      // Verify updateDocument was called
      assert.strictEqual(mockPaperlessService._updateCalls.length, 1);
      const call = mockPaperlessService._updateCalls[0];
      assert.strictEqual(call.docId, testDocId);
      assert.ok(Array.isArray(call.updates.custom_fields));

      // Find status field
      const statusField = call.updates.custom_fields.find(
        cf => cf.name === FIELD_NAMES.STATUS
      );
      assert.strictEqual(statusField.value, NORMALIZATION_STATUS.COMPLETED);
    });

    it('should return error for invalid docId', async function() {
      const pages = [{ page: 1, buffer: testPage1Buffer }];

      const result1 = await store.store(null, pages, {});
      assert.strictEqual(result1.success, false);
      assert.ok(result1.error.includes('Invalid'));

      const result2 = await store.store(-1, pages, {});
      assert.strictEqual(result2.success, false);

      const result3 = await store.store('abc', pages, {});
      assert.strictEqual(result3.success, false);
    });

    it('should return error for empty pages array', async function() {
      const result = await store.store(testDocId, [], {});

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('No pages'));
    });

    it('should skip invalid page data and continue', async function() {
      const pages = [
        { page: 1, buffer: testPage1Buffer },
        { page: 2, invalid: 'data' }, // Invalid - no buffer or base64
        { page: 3, buffer: testPage2Buffer }
      ];

      const result = await store.store(testDocId, pages, {});

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.pageCount, 2); // Only 2 valid pages

      // Verify only valid pages written
      await assert.rejects(
        fs.access(store.getPagePath(testDocId, 2)),
        { code: 'ENOENT' }
      );
    });

    it('should handle Paperless update failure gracefully', async function() {
      mockPaperlessService._shouldFail = true;
      mockPaperlessService._failMessage = 'Paperless API unavailable';

      const pages = [{ page: 1, buffer: testPage1Buffer }];

      // Should succeed - files are still written
      const result = await store.store(testDocId, pages, {});

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.pageCount, 1);

      // File should still exist
      const fileContent = await fs.readFile(store.getPagePath(testDocId, 1));
      assert.deepStrictEqual(fileContent, testPage1Buffer);

      // Warning should be logged
      const warnLog = mockLogger._logs.find(
        l => l.level === 'warn' && l.event === 'normalization_metadata_update_failed'
      );
      assert.ok(warnLog);
    });

    it('should update status to failed and rethrow on file write error', async function() {
      // Use a path with invalid characters that will fail on all platforms
      // On Windows, characters like : in middle of path are invalid
      // On Unix, using a read-only root path or null bytes
      const invalidPath = process.platform === 'win32'
        ? 'Z:\\nonexistent\\path:invalid:chars'
        : '/dev/null/impossible/path';

      const badStore = new NormalizationStore({
        baseDir: invalidPath,
        paperlessService: mockPaperlessService,
        logger: mockLogger
      });

      const pages = [{ page: 1, buffer: testPage1Buffer }];

      await assert.rejects(
        badStore.store(testDocId, pages, {}),
        /ENOENT|EPERM|EACCES|EINVAL|ENOTDIR/
      );

      // Error should be logged
      const errorLog = mockLogger._logs.find(
        l => l.level === 'error' && l.event === 'normalization_store_error'
      );
      assert.ok(errorLog);
    });
  });

  // ==========================================================================
  // isNormalized() Tests
  // ==========================================================================

  describe('isNormalized()', function() {
    it('should return true when status is completed', async function() {
      // Setup document with completed status
      mockPaperlessService._documents.set(testDocId, {
        id: testDocId,
        custom_fields: [
          { name: FIELD_NAMES.STATUS, value: NORMALIZATION_STATUS.COMPLETED }
        ]
      });

      const result = await store.isNormalized(testDocId);
      assert.strictEqual(result, true);
    });

    it('should return false when status is pending', async function() {
      mockPaperlessService._documents.set(testDocId, {
        id: testDocId,
        custom_fields: [
          { name: FIELD_NAMES.STATUS, value: NORMALIZATION_STATUS.PENDING }
        ]
      });

      const result = await store.isNormalized(testDocId);
      assert.strictEqual(result, false);
    });

    it('should return false when status is processing', async function() {
      mockPaperlessService._documents.set(testDocId, {
        id: testDocId,
        custom_fields: [
          { name: FIELD_NAMES.STATUS, value: NORMALIZATION_STATUS.PROCESSING }
        ]
      });

      const result = await store.isNormalized(testDocId);
      assert.strictEqual(result, false);
    });

    it('should return false when status is failed', async function() {
      mockPaperlessService._documents.set(testDocId, {
        id: testDocId,
        custom_fields: [
          { name: FIELD_NAMES.STATUS, value: NORMALIZATION_STATUS.FAILED }
        ]
      });

      const result = await store.isNormalized(testDocId);
      assert.strictEqual(result, false);
    });

    it('should fallback to disk check when Paperless API fails', async function() {
      mockPaperlessService._shouldFail = true;

      // Create file on disk
      const docDir = store.getDocDir(testDocId);
      await fs.mkdir(docDir, { recursive: true });
      await fs.writeFile(store.getPagePath(testDocId, 1), testPage1Buffer);

      const result = await store.isNormalized(testDocId);
      assert.strictEqual(result, true);
    });

    it('should return false when no status and no file on disk', async function() {
      const result = await store.isNormalized(testDocId);
      assert.strictEqual(result, false);
    });

    it('should return false for invalid docId', async function() {
      assert.strictEqual(await store.isNormalized(null), false);
      assert.strictEqual(await store.isNormalized(-1), false);
      assert.strictEqual(await store.isNormalized('invalid'), false);
    });
  });

  // ==========================================================================
  // getStatus() Tests
  // ==========================================================================

  describe('getStatus()', function() {
    it('should return all fields when present', async function() {
      const metaObj = { geometry: 'test', timestamp: '2026-01-01T00:00:00Z' };
      mockPaperlessService._documents.set(testDocId, {
        id: testDocId,
        custom_fields: [
          { name: FIELD_NAMES.STATUS, value: NORMALIZATION_STATUS.COMPLETED },
          { name: FIELD_NAMES.URL, value: '/api/normalized/12345/1' },
          { name: FIELD_NAMES.META, value: JSON.stringify(metaObj) }
        ]
      });

      const result = await store.getStatus(testDocId);

      assert.strictEqual(result.status, NORMALIZATION_STATUS.COMPLETED);
      assert.strictEqual(result.url, '/api/normalized/12345/1');
      assert.deepStrictEqual(result.meta, metaObj);
    });

    it('should return nulls when no custom fields', async function() {
      mockPaperlessService._documents.set(testDocId, {
        id: testDocId,
        custom_fields: []
      });

      const result = await store.getStatus(testDocId);

      assert.strictEqual(result.status, null);
      assert.strictEqual(result.url, null);
      assert.strictEqual(result.meta, null);
    });

    it('should handle malformed JSON in meta field', async function() {
      mockPaperlessService._documents.set(testDocId, {
        id: testDocId,
        custom_fields: [
          { name: FIELD_NAMES.STATUS, value: NORMALIZATION_STATUS.COMPLETED },
          { name: FIELD_NAMES.META, value: '{invalid json' }
        ]
      });

      const result = await store.getStatus(testDocId);

      assert.strictEqual(result.status, NORMALIZATION_STATUS.COMPLETED);
      assert.deepStrictEqual(result.meta, { raw: '{invalid json' });

      // Warning should be logged
      const warnLog = mockLogger._logs.find(
        l => l.level === 'warn' && l.event === 'normalization_meta_parse_error'
      );
      assert.ok(warnLog);
    });

    it('should return nulls for invalid docId', async function() {
      const result = await store.getStatus(null);
      assert.deepStrictEqual(result, { status: null, url: null, meta: null });
    });

    it('should return nulls on Paperless API error', async function() {
      mockPaperlessService._shouldFail = true;

      const result = await store.getStatus(testDocId);
      assert.deepStrictEqual(result, { status: null, url: null, meta: null });
    });
  });

  // ==========================================================================
  // updatePaperlessMetadata() Tests
  // ==========================================================================

  describe('updatePaperlessMetadata()', function() {
    it('should update status only', async function() {
      const result = await store.updatePaperlessMetadata(
        testDocId,
        NORMALIZATION_STATUS.PROCESSING,
        null,
        null
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(mockPaperlessService._updateCalls.length, 1);

      const call = mockPaperlessService._updateCalls[0];
      assert.strictEqual(call.updates.custom_fields.length, 1);
      assert.strictEqual(call.updates.custom_fields[0].name, FIELD_NAMES.STATUS);
      assert.strictEqual(call.updates.custom_fields[0].value, NORMALIZATION_STATUS.PROCESSING);
    });

    it('should update all fields', async function() {
      const meta = { action: 'rotate', degree: 90 };

      const result = await store.updatePaperlessMetadata(
        testDocId,
        NORMALIZATION_STATUS.COMPLETED,
        '/api/normalized/123/1',
        meta
      );

      assert.strictEqual(result.success, true);

      const call = mockPaperlessService._updateCalls[0];
      assert.strictEqual(call.updates.custom_fields.length, 3);

      // Verify meta is stringified
      const metaField = call.updates.custom_fields.find(
        cf => cf.name === FIELD_NAMES.META
      );
      assert.strictEqual(metaField.value, JSON.stringify(meta));
    });

    it('should reject invalid status', async function() {
      const result = await store.updatePaperlessMetadata(
        testDocId,
        'invalid_status',
        null,
        null
      );

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Invalid status'));
    });

    it('should reject invalid docId', async function() {
      const result = await store.updatePaperlessMetadata(
        null,
        NORMALIZATION_STATUS.COMPLETED,
        null,
        null
      );

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Invalid'));
    });

    it('should handle Paperless API failure', async function() {
      mockPaperlessService._shouldFail = true;
      mockPaperlessService._failMessage = 'Connection refused';

      const result = await store.updatePaperlessMetadata(
        testDocId,
        NORMALIZATION_STATUS.COMPLETED,
        null,
        null
      );

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Connection refused'));
    });
  });

  // ==========================================================================
  // getStats() Tests
  // ==========================================================================

  describe('getStats()', function() {
    it('should return zeros when baseDir is empty', async function() {
      const stats = await store.getStats();

      assert.strictEqual(stats.totalDocuments, 0);
      assert.strictEqual(stats.diskUsageBytes, 0);
    });

    it('should count documents and calculate disk usage', async function() {
      // Create some test files
      const doc1Dir = store.getDocDir(1);
      const doc2Dir = store.getDocDir(2);

      await fs.mkdir(doc1Dir, { recursive: true });
      await fs.mkdir(doc2Dir, { recursive: true });

      await fs.writeFile(path.join(doc1Dir, 'page_1.png'), testPage1Buffer);
      await fs.writeFile(path.join(doc2Dir, 'page_1.png'), testPage1Buffer);
      await fs.writeFile(path.join(doc2Dir, 'page_2.png'), testPage2Buffer);

      const stats = await store.getStats();

      assert.strictEqual(stats.totalDocuments, 2);
      const expectedSize = testPage1Buffer.length * 2 + testPage2Buffer.length;
      assert.strictEqual(stats.diskUsageBytes, expectedSize);
    });

    it('should return zeros when baseDir does not exist', async function() {
      // Use a truly nonexistent path that won't be accidentally created
      const nonexistentPath = process.platform === 'win32'
        ? 'Z:\\nonexistent\\path\\that\\does\\not\\exist'
        : '/nonexistent/path/that/does/not/exist';

      const nonexistentStore = new NormalizationStore({
        baseDir: nonexistentPath,
        paperlessService: mockPaperlessService,
        logger: mockLogger
      });

      const stats = await nonexistentStore.getStats();

      assert.strictEqual(stats.totalDocuments, 0);
      assert.strictEqual(stats.diskUsageBytes, 0);
    });

    it('should track operation stats', async function() {
      // Perform some operations
      const pages = [{ page: 1, buffer: testPage1Buffer }];
      await store.store(testDocId, pages, {});

      const stats = await store.getStats();

      assert.strictEqual(stats.stored, 1);
      assert.ok(stats.lastOperation);
    });
  });

  // ==========================================================================
  // delete() Tests
  // ==========================================================================

  describe('delete()', function() {
    it('should delete document directory', async function() {
      // Create test files first
      const docDir = store.getDocDir(testDocId);
      await fs.mkdir(docDir, { recursive: true });
      await fs.writeFile(store.getPagePath(testDocId, 1), testPage1Buffer);

      const result = await store.delete(testDocId);

      assert.strictEqual(result.success, true);

      // Verify directory is gone
      await assert.rejects(
        fs.access(docDir),
        { code: 'ENOENT' }
      );
    });

    it('should succeed when directory does not exist', async function() {
      const result = await store.delete(99999);
      assert.strictEqual(result.success, true);
    });

    it('should update Paperless metadata to pending', async function() {
      const docDir = store.getDocDir(testDocId);
      await fs.mkdir(docDir, { recursive: true });
      await fs.writeFile(store.getPagePath(testDocId, 1), testPage1Buffer);

      await store.delete(testDocId);

      // Verify metadata update
      const call = mockPaperlessService._updateCalls.find(
        c => c.docId === testDocId
      );
      assert.ok(call);

      const statusField = call.updates.custom_fields.find(
        cf => cf.name === FIELD_NAMES.STATUS
      );
      assert.strictEqual(statusField.value, NORMALIZATION_STATUS.PENDING);
    });

    it('should reject invalid docId', async function() {
      const result = await store.delete(null);
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Invalid'));
    });
  });

  // ==========================================================================
  // NORMALIZATION_STATUS enum Tests
  // ==========================================================================

  describe('NORMALIZATION_STATUS', function() {
    it('should have all required status values', function() {
      assert.strictEqual(NORMALIZATION_STATUS.PENDING, 'pending');
      assert.strictEqual(NORMALIZATION_STATUS.PROCESSING, 'processing');
      assert.strictEqual(NORMALIZATION_STATUS.COMPLETED, 'completed');
      assert.strictEqual(NORMALIZATION_STATUS.FAILED, 'failed');
      assert.strictEqual(NORMALIZATION_STATUS.SKIPPED, 'skipped');
    });
  });

  // ==========================================================================
  // FIELD_NAMES Tests
  // ==========================================================================

  describe('FIELD_NAMES', function() {
    it('should have correct field names', function() {
      assert.strictEqual(FIELD_NAMES.URL, 'ai_normalized_url');
      assert.strictEqual(FIELD_NAMES.STATUS, 'ai_normalization_status');
      assert.strictEqual(FIELD_NAMES.META, 'ai_normalization_meta');
    });
  });
});
