#!/usr/bin/env node
/**
 * create-normalization-custom-fields.js
 *
 * Migration script to create custom fields for document normalization tracking.
 * Creates 3 fields:
 *   - ai_normalized_url: URL to persisted normalized image
 *   - ai_normalization_status: Status enum (pending, processing, completed, failed, skipped)
 *   - ai_normalization_meta: JSON metadata (geometry, actions, timestamp)
 *
 * Usage:
 *   node migrations/create-normalization-custom-fields.js [--dry-run]
 *
 * Environment Variables:
 *   PAPERLESS_API_URL   - Paperless-ngx API URL
 *   PAPERLESS_API_TOKEN - Paperless-ngx API token
 *
 * @see docs/AUTOMATIC_NORMALIZATION_PLAN.md
 */

const path = require('path');
const fs = require('fs');

// Load authoritative environment sources for protected connection settings.
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), 'docker-compose.env'),
    path.join(process.cwd(), '.env')
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^#=][^=]*)=(.*)$/);
        if (match && !process.env[match[1].trim()]) {
          process.env[match[1].trim()] = match[2].trim();
        }
      });
    }
  }
}
loadEnv();

// Field definitions for normalization tracking
const NORMALIZATION_FIELDS = [
  {
    name: 'ai_normalized_url',
    data_type: 'url',
    extra_data: null,
    description: 'URL to persisted normalized document image'
  },
  {
    name: 'ai_normalization_status',
    data_type: 'string',
    extra_data: {
      select_options: ['pending', 'processing', 'completed', 'failed', 'skipped']
    },
    description: 'Document normalization status'
  },
  {
    name: 'ai_normalization_meta',
    data_type: 'string',
    extra_data: { format: 'json' },
    description: 'JSON metadata: geometry analysis, actions applied, timestamps'
  }
];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

/**
 * Run the migration to create normalization custom fields
 * @returns {Promise<{success: boolean, results: Array, errors: Array}>}
 */
async function runMigration() {
  console.log('\n🔧 Normalization Custom Fields Migration');
  console.log('═'.repeat(50));

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE: No changes will be made.\n');
  }

  // Lazy-load paperlessService to avoid config issues during module load
  let paperlessService;
  try {
    paperlessService = require('../services/paperlessService');
    // Ensure service is initialized
    if (typeof paperlessService.initialize === 'function') {
      paperlessService.initialize();
    }
  } catch (loadError) {
    console.error('❌ Failed to load paperlessService:', loadError.message);
    return {
      success: false,
      results: [],
      errors: [{ field: 'N/A', error: `Service load failed: ${loadError.message}` }]
    };
  }

  const results = [];
  const errors = [];

  for (const fieldDef of NORMALIZATION_FIELDS) {
    console.log(`\n📝 Field: ${fieldDef.name}`);
    console.log(`   Type: ${fieldDef.data_type}`);
    console.log(`   Description: ${fieldDef.description}`);

    if (DRY_RUN) {
      console.log('   ⏭️  Skipped (dry-run)');
      results.push({
        field: fieldDef.name,
        status: 'skipped',
        reason: 'dry-run'
      });
      continue;
    }

    try {
      // Check if field already exists
      const existing = await paperlessService.findExistingCustomField(fieldDef.name);
      if (existing && existing.id) {
        console.log(`   ✅ Already exists (ID: ${existing.id})`);
        results.push({
          field: fieldDef.name,
          status: 'exists',
          id: existing.id
        });
        continue;
      }

      // Create the field
      const created = await paperlessService.createCustomFieldSafely(
        fieldDef.name,
        fieldDef.data_type,
        fieldDef.extra_data?.default_currency || null
      );

      if (created && created.id) {
        console.log(`   ✅ Created (ID: ${created.id})`);
        results.push({
          field: fieldDef.name,
          status: 'created',
          id: created.id
        });
      } else if (created && created.success === false) {
        // Handle error response from createCustomFieldSafely
        const errorType = created.error?.type || 'unknown';
        const errorMsg = created.error?.message || 'Unknown error';

        if (errorType === 'already_exists') {
          console.log(`   ✅ Already exists (found via error)`);
          results.push({
            field: fieldDef.name,
            status: 'exists',
            id: null
          });
        } else {
          console.log(`   ❌ Failed: ${errorType} - ${errorMsg}`);
          errors.push({
            field: fieldDef.name,
            error: errorMsg,
            type: errorType
          });
        }
      } else {
        console.log('   ❌ Failed: Unknown response format');
        errors.push({
          field: fieldDef.name,
          error: 'Unknown response format',
          type: 'unknown'
        });
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      errors.push({
        field: fieldDef.name,
        error: err.message,
        type: 'exception'
      });
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Migration Summary');
  console.log('═'.repeat(50));

  const created = results.filter(r => r.status === 'created').length;
  const existing = results.filter(r => r.status === 'exists').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`   Created: ${created}`);
  console.log(`   Already Existed: ${existing}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors.length}`);

  const success = errors.length === 0;
  if (success) {
    console.log('\n✅ Migration completed successfully!\n');
  } else {
    console.log('\n⚠️  Migration completed with errors.\n');
    console.log('Errors:');
    errors.forEach(e => console.log(`   - ${e.field}: ${e.error}`));
    console.log('');
  }

  return { success, results, errors };
}

// Main execution
if (require.main === module) {
  runMigration()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('❌ Migration failed with exception:', err.message);
      process.exit(1);
    });
}

module.exports = { runMigration, NORMALIZATION_FIELDS };
