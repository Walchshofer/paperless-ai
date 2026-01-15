/**
 * verify-qdrant-alpha9.js
 * Verifies that Qdrant collections exist and have the correct configuration
 * for Native Protocol Alpha-9.
 */

const { QdrantClient } = require('@qdrant/js-client-rest');

const HOST = process.env.QDRANT_HOST || 'localhost';
const PORT = process.env.QDRANT_PORT || 6333;

const EXPECTED_COLLECTIONS = {
    'document_embeddings': { size: 384, distance: 'Cosine' },
    'visual_overlays': { size: 320, distance: 'Cosine' },
    'visual_pages': { size: 320, distance: 'Dot' }
};

async function verify() {
    console.log(`🔍 Verifying Qdrant at ${HOST}:${PORT}...`);
    const client = new QdrantClient({ url: `http://${HOST}:${PORT}` });

    try {
        const result = await client.getCollections();
        const existing = new Map(result.collections.map(c => [c.name, c]));

        let allOk = true;

        for (const [name, config] of Object.entries(EXPECTED_COLLECTIONS)) {
            if (!existing.has(name)) {
                console.error(`❌ Missing collection: ${name}`);
                allOk = false;
                continue;
            }

            // Fetch detailed info to check config
            const info = await client.getCollection(name);
            const params = info.config.params.vectors;
            
            // Handle Qdrant's nested vector config structure if present, or simple structure
            const size = params.size || params.default?.size;
            const distance = params.distance || params.default?.distance;

            if (size !== config.size || distance !== config.distance) {
                console.error(`❌ Invalid config for ${name}: Expected ${config.size}/${config.distance}, got ${size}/${distance}`);
                allOk = false;
            } else {
                console.log(`✅ ${name}: OK (${size}d, ${distance})`);
            }
        }

        if (allOk) console.log('\n🎉 Alpha-9 Verification PASSED');
        else console.error('\n💥 Alpha-9 Verification FAILED');
        process.exit(allOk ? 0 : 1);

    } catch (err) {
        console.error('Connection failed:', err.message);
        process.exit(1);
    }
}

verify();