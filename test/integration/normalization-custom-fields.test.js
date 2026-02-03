/* eslint-env mocha */
/**
 * test/integration/normalization-custom-fields.test.js
 *
 * Integration tests for normalization custom fields migration.
 * Tests against real Paperless-ngx API when available.
 *
 * Requirements:
 *   - PAPERLESS_API_URL and PAPERLESS_API_TOKEN environment variables
 *   - Running Paperless-ngx instance
 *
 * Skip behavior:
 *   - Tests are skipped if Paperless API is not available
 *
 * @see migrations/create-normalization-custom-fields.js
 */

const assert = require('assert');

// Import migration module
const {
  runMigration,
  NORMALIZATION_FIELDS
} = require('../../migrations/create-normalization-custom-fields');

// Import constants from NormalizationStore
const { FIELD_NAMES } = require('../../services/normalization/NormalizationStore');

describe('Normalization Custom Fields Integration', function() {
  this.timeout(30000);

  let paperlessService;
  let paperlessAvailable = false;

  before(async function() {
    // Check if Paperless is available
    try {
      paperlessService = require('../../services/paperlessService');

      if (typeof paperlessService.initialize === 'function') {
        paperlessService.initialize();
      }

      // Try to make a health check call
      const health = await paperlessService.checkHealth?.() ||
        await paperlessService.getDocumentCount?.();

      if (health !== undefined && health !== null) {
        paperlessAvailable = true;
        console.log('    ✓ Paperless API available');
      }
    } catch (err) {
      console.log(`    ⚠ Paperless API not available: ${err.message}`);
      console.log('    → Integration tests will be skipped');
    }
  });

  describe('Migration Script', function() {
    it('should define correct field specifications', function() {
      // This test always runs - validates field definitions
      assert.strictEqual(NORMALIZATION_FIELDS.length, 3);

      const urlField = NORMALIZATION_FIELDS.find(f => f.name === FIELD_NAMES.URL);
      assert.ok(urlField, 'ai_normalized_url field should be defined');
      assert.strictEqual(urlField.data_type, 'url');

      const statusField = NORMALIZATION_FIELDS.find(f => f.name === FIELD_NAMES.STATUS);
      assert.ok(statusField, 'ai_normalization_status field should be defined');
      assert.strictEqual(statusField.data_type, 'string');
      assert.ok(statusField.extra_data?.select_options);
      assert.ok(statusField.extra_data.select_options.includes('pending'));
      assert.ok(statusField.extra_data.select_options.includes('completed'));
      assert.ok(statusField.extra_data.select_options.includes('failed'));

      const metaField = NORMALIZATION_FIELDS.find(f => f.name === FIELD_NAMES.META);
      assert.ok(metaField, 'ai_normalization_meta field should be defined');
      assert.strictEqual(metaField.data_type, 'string');
    });

    it('should run migration successfully', async function() {
      if (!paperlessAvailable) {
        this.skip();
        return;
      }

      const result = await runMigration();

      assert.ok(result, 'Migration should return a result');
      assert.ok(Array.isArray(result.results), 'Results should be an array');
      assert.ok(Array.isArray(result.errors), 'Errors should be an array');

      // All fields should either be created or already exist
      const successfulFields = result.results.filter(
        r => r.status === 'created' || r.status === 'exists'
      );
      assert.strictEqual(
        successfulFields.length,
        NORMALIZATION_FIELDS.length,
        'All fields should be created or exist'
      );

      // No errors expected on valid setup
      assert.strictEqual(
        result.errors.length,
        0,
        `Expected no errors, got: ${JSON.stringify(result.errors)}`
      );
    });

    it('should handle already-exists gracefully on re-run', async function() {
      if (!paperlessAvailable) {
        this.skip();
        return;
      }

      // Run migration twice
      await runMigration();
      const secondResult = await runMigration();

      // All fields should report as existing
      const existingFields = secondResult.results.filter(r => r.status === 'exists');
      assert.strictEqual(
        existingFields.length,
        NORMALIZATION_FIELDS.length,
        'All fields should exist on second run'
      );

      assert.strictEqual(secondResult.errors.length, 0);
    });
  });

  describe('Field Queryability', function() {
    it('should find ai_normalized_url field', async function() {
      if (!paperlessAvailable) {
        this.skip();
        return;
      }

      // Ensure migration has run
      await runMigration();

      const field = await paperlessService.findExistingCustomField(FIELD_NAMES.URL);

      assert.ok(field, 'Field should be found');
      assert.ok(field.id, 'Field should have an ID');
      assert.ok(
        field.name.toLowerCase().includes('normalized') ||
        field.name === FIELD_NAMES.URL,
        `Field name should match: ${field.name}`
      );
    });

    it('should find ai_normalization_status field', async function() {
      if (!paperlessAvailable) {
        this.skip();
        return;
      }

      await runMigration();

      const field = await paperlessService.findExistingCustomField(FIELD_NAMES.STATUS);

      assert.ok(field, 'Field should be found');
      assert.ok(field.id, 'Field should have an ID');
    });

    it('should find ai_normalization_meta field', async function() {
      if (!paperlessAvailable) {
        this.skip();
        return;
      }

      await runMigration();

      const field = await paperlessService.findExistingCustomField(FIELD_NAMES.META);

      assert.ok(field, 'Field should be found');
      assert.ok(field.id, 'Field should have an ID');
    });
  });

  describe('Field Cache', function() {
    it('should refresh cache and include new fields', async function() {
      if (!paperlessAvailable) {
        this.skip();
        return;
      }

      // Ensure migration has run
      await runMigration();

      // Refresh cache
      if (typeof paperlessService.refreshCustomFieldCache === 'function') {
        await paperlessService.refreshCustomFieldCache();
      }

      // All three fields should be findable
      const urlField = await paperlessService.findExistingCustomField(FIELD_NAMES.URL);
      const statusField = await paperlessService.findExistingCustomField(FIELD_NAMES.STATUS);
      const metaField = await paperlessService.findExistingCustomField(FIELD_NAMES.META);

      assert.ok(urlField?.id, 'URL field should be in cache');
      assert.ok(statusField?.id, 'Status field should be in cache');
      assert.ok(metaField?.id, 'Meta field should be in cache');
    });
  });
});
