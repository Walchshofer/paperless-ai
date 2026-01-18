/**
 * scripts/migrate-legacy-docs.js
 * 
 * Migration utility to move legacy SCN documents from the deprecated ChromaDB source location
 * to the Paperless-ngx consume folder.
 * 
 * This triggers the new PostgreSQL/pg-vector ingestion pipeline via the DocumentProcessor.
 * 
 * Usage:
 *   LEGACY_SOURCE_DIR=/path/to/old/docs PAPERLESS_CONSUME_DIR=/path/to/consume node scripts/migrate-legacy-docs.js
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const LOG_PREFIX = '[Migration]';

const config = {
    // Default to a 'legacy_documents' folder in data if not specified
    sourceDir: process.env.LEGACY_SOURCE_DIR || path.join(process.cwd(), 'data', 'legacy_documents'),
    // Default to scanned_files folder
    consumeDir: process.env.PAPERLESS_CONSUME_DIR || 'C:\\Users\\pwalc\\MyApps\\paperless-ngx\\scanned_files',
    // Paperless API Configuration
    apiUrl: process.env.PAPERLESS_API_URL || 'http://localhost:8000',
    username: process.env.PAPERLESS_USERNAME,
    password: process.env.PAPERLESS_PASSWORD,
    token: process.env.PAPERLESS_API_TOKEN,
    // File types to migrate
    allowedExtensions: new Set(['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif']),
    // Throttle to prevent overwhelming the consumer/Ollama
    throttleMs: 5000
};

async function migrate() {
    console.log(`${LOG_PREFIX} Starting migration from legacy storage...`);
    console.log(`${LOG_PREFIX} Source: ${config.sourceDir}`);
    console.log(`${LOG_PREFIX} Target: ${config.consumeDir}`);

    // Attempt authentication if credentials provided (verifies API connectivity)
    if (!config.token && config.username && config.password) {
        try {
            console.log(`${LOG_PREFIX} Authenticating with Paperless API...`);
            const response = await axios.post(`${config.apiUrl}/api/token/`, {
                username: config.username,
                password: config.password
            });
            config.token = response.data.token;
            console.log(`${LOG_PREFIX} Authentication successful.`);
        } catch (error) {
            console.warn(`${LOG_PREFIX} Authentication failed: ${error.message}. Continuing with file copy...`);
        }
    }

    try {
        // Verify directories exist
        await fs.access(config.sourceDir).catch(() => {
            throw new Error(`Source directory not found: ${config.sourceDir}`);
        });
        await fs.access(config.consumeDir).catch(() => {
            throw new Error(`Consume directory not found: ${config.consumeDir}`);
        });

        const files = await fs.readdir(config.sourceDir);
        let count = 0;
        let skipped = 0;

        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (!config.allowedExtensions.has(ext)) {
                skipped++;
                continue;
            }

            const sourcePath = path.join(config.sourceDir, file);
            const targetPath = path.join(config.consumeDir, file);

            // Verify it's a file
            const stats = await fs.stat(sourcePath);
            if (!stats.isFile()) continue;

            console.log(`${LOG_PREFIX} Migrating ${file}...`);
            
            // Copy then unlink is safer across different volumes/mounts than rename
            try {
                await fs.copyFile(sourcePath, targetPath);
                await fs.unlink(sourcePath);
                count++;
                
                // Throttle to allow Paperless & Ollama to catch up
                if (count < files.length) {
                    await new Promise(resolve => setTimeout(resolve, config.throttleMs));
                }
            } catch (err) {
                console.error(`${LOG_PREFIX} Failed to migrate ${file}:`, err.message);
            }
        }

        console.log(`${LOG_PREFIX} Migration complete.`);
        console.log(`${LOG_PREFIX} Moved: ${count}`);
        console.log(`${LOG_PREFIX} Skipped (invalid type): ${skipped}`);

    } catch (error) {
        console.error(`${LOG_PREFIX} Fatal error:`, error.message);
        process.exit(1);
    }
}

migrate();
