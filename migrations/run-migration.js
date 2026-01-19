#!/usr/bin/env node
/**
 * run-migration.js
 *
 * Runs SQL migrations against the PostgreSQL database.
 * Supports both Windows host and Docker environments.
 *
 * Usage:
 *   node migrations/run-migration.js [migration-file]
 *   node migrations/run-migration.js                    # Runs init_council_storage.sql
 *   node migrations/run-migration.js some-migration.sql
 *
 * Environment Variables:
 *   POSTGRES_HOST     - Database host (default: localhost)
 *   POSTGRES_PORT     - Database port (default: 5432)
 *   POSTGRES_DB       - Database name (default: paperless)
 *   POSTGRES_USER     - Database user (default: paperless)
 *   POSTGRES_PASSWORD - Database password (required)
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuration

/**
 * Get required environment variable with fallback
 * Exits with error message if not found
 */
function requireEnv(key, fallbackKey = null) {
    const value = process.env[key];
    if (value && value !== '') return value;
    
    if (fallbackKey) {
        const fallbackValue = process.env[fallbackKey];
        if (fallbackValue && fallbackValue !== '') return fallbackValue;
    }
    
    const keys = fallbackKey ? `${key} or ${fallbackKey}` : key;
    console.error(`\n❌ Missing required environment variable: ${keys}`);
    console.error('💡 Set this in your docker-compose.env file or export it before running.\n');
    process.exit(1);
}

const config = {
    host: process.env.POSTGRES_HOST || process.env.PAPERLESS_DBHOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'paperless',
    user: requireEnv('POSTGRES_USER', 'PAPERLESS_DBUSER'),
    password: requireEnv('POSTGRES_PASSWORD', 'PAPERLESS_DBPASS')
};

async function runMigration(migrationFile) {
    const pool = new Pool(config);

    console.log(`\n🔌 Connecting to PostgreSQL at ${config.host}:${config.port}/${config.database}...`);

    try {
        // Test connection
        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL');

        // Read migration file
        const migrationPath = path.resolve(__dirname, migrationFile);
        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found: ${migrationPath}`);
        }

        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log(`📄 Running migration: ${migrationFile}`);
        console.log(`   File: ${migrationPath}`);
        console.log(`   Size: ${sql.length} bytes`);

        // Execute migration
        await client.query(sql);
        console.log('✅ Migration executed successfully');

        // Verify table exists
        const tableCheck = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'visual_overlays'
        `);

        if (tableCheck.rows.length > 0) {
            console.log('✅ visual_overlays table exists');

            // Show table structure
            const columns = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'visual_overlays'
                ORDER BY ordinal_position
            `);

            console.log('\n📋 Table structure:');
            columns.rows.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
            });
        }

        // Enforce policy: pgvector is deprecated and must not be present in runtime clusters.
        const vectorCheck = await client.query(`
            SELECT extname FROM pg_extension WHERE extname = 'vector'
        `);

        if (vectorCheck.rows.length > 0) {
            console.error('\n❌ pgvector extension detected. pgvector is deprecated and not supported as a runtime layer.');
            console.error('Please remove the extension (DROP EXTENSION vector CASCADE) and run the cleanup script: scripts/purge-pgvector.sh');
            process.exit(2);
        } else {
            console.log('✅ pgvector not present (ok)');
        }

        client.release();
        console.log('\n🎉 Migration complete!\n');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Troubleshooting:');
            console.log('   1. Is PostgreSQL running? Check: docker ps');
            console.log('   2. Is port 5432 exposed? Check docker-compose.yml');
            console.log('   3. Try: docker-compose -f ../docker-compose.yml restart db');
        }

        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Main
const migrationFile = process.argv[2] || 'init_council_storage.sql';
runMigration(migrationFile);
